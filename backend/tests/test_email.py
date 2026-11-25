"""Tests de la composition et de l'envoi des e-mails."""

import smtplib
from email.message import EmailMessage
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.services import email_service
from app.services.notification_service import PendingEmail


class FakeSMTP:
    """Remplace smtplib.SMTP : garde les messages au lieu de les envoyer."""

    sent: list[EmailMessage] = []
    fail = False

    def __init__(self, host: str, port: int, timeout: int) -> None:
        if FakeSMTP.fail:
            raise ConnectionRefusedError("serveur injoignable")
        self.host, self.port = host, port

    def __enter__(self) -> "FakeSMTP":
        return self

    def __exit__(self, *args: Any) -> None:
        return None

    def starttls(self) -> None: ...

    def login(self, user: str, password: str) -> None: ...

    def send_message(self, message: EmailMessage) -> None:
        FakeSMTP.sent.append(message)


@pytest.fixture
def smtp(monkeypatch: pytest.MonkeyPatch) -> type[FakeSMTP]:
    FakeSMTP.sent, FakeSMTP.fail = [], False
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    return FakeSMTP


def _html(message: EmailMessage) -> str:
    part = message.get_body(preferencelist=("html",))
    assert part is not None
    return part.get_content()


def test_notification_email_content() -> None:
    message = email_service.build_message(
        to="aya@orea.ci", name="Aya Kouassi",
        subject="Bonne nouvelle, ta CNI t'attend à Cocody !",
        body="Une pièce correspondant à ta déclaration a été déposée.",
        link="/reclamer/123",
    )
    html = _html(message)
    text = message.get_body(preferencelist=("plain",)).get_content()  # type: ignore[union-attr]

    assert message["To"] == "Aya Kouassi <aya@orea.ci>"
    assert "Bonne nouvelle, ta CNI t&#39;attend à Cocody !" in html
    assert f"{settings.FRONTEND_URL}/reclamer/123" in html
    assert "Récupérer ma pièce" in html
    assert "#F08A24" in html  # bouton orange de la charte
    assert "Bonjour Aya Kouassi" in text and "/reclamer/123" in text


def test_user_content_is_escaped() -> None:
    message = email_service.build_message(to="a@orea.ci", name="<script>alert(1)</script>",
                                          subject="Test", body="Corps")
    assert "<script>" not in _html(message)


def test_send_notification_email(smtp: type[FakeSMTP]) -> None:
    ok = email_service.send_notification_email(PendingEmail(
        to="aya@orea.ci", name="Aya", subject="Sujet", body="Corps", link=None))
    assert ok is True
    assert smtp.sent[0]["Subject"] == "Sujet"


def test_smtp_failure_never_raises(smtp: type[FakeSMTP]) -> None:
    smtp.fail = True
    assert email_service.send_notification_email(PendingEmail(
        to="aya@orea.ci", name="Aya", subject="Sujet", body="Corps", link=None)) is False


def test_disabled_email_is_not_sent(smtp: type[FakeSMTP],
                                    monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "EMAIL_ENABLED", False)
    assert email_service.send(email_service.build_message(
        to="a@orea.ci", name="A", subject="S", body="B")) is False
    assert smtp.sent == []


def test_welcome_email_on_register(client: TestClient, smtp: type[FakeSMTP]) -> None:
    client.post(f"{settings.API_PREFIX}/auth/register", json={
        "email": "awa@orea.ci", "password": "Secret1234", "full_name": "Awa Diallo"})
    assert [m["Subject"] for m in smtp.sent] == ["Bienvenue sur Orea !"]


def test_match_sends_emails_after_commit(client: TestClient, smtp: type[FakeSMTP],
                                         finder: Any, owner: Any, relay: Any) -> None:
    from tests.conftest import auth, found_payload, lost_payload

    api = settings.API_PREFIX
    client.post(f"{api}/lost", json=lost_payload(), headers=auth(owner))
    client.post(f"{api}/found", json=found_payload(relay), headers=auth(finder))
    subjects = {m["Subject"]: m["To"] for m in smtp.sent}
    assert "proprio@orea.ci" in subjects["Bonne nouvelle, ta CNI t'attend à Cocody !"]
    assert "trouveur@orea.ci" in subjects["Ta trouvaille a peut-être retrouvé son propriétaire !"]


def test_file_backend_saves_html_to_outbox(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    """Mode local sans serveur d'e-mail : le message devient un fichier HTML."""
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "file")
    monkeypatch.setattr(settings, "OUTBOX_DIR", str(tmp_path))
    ok = email_service.send(email_service.build_message(
        to="aya@orea.ci", name="Aya", subject="Bonne nouvelle, ta CNI t'attend à Cocody !",
        body="Corps", link="/reclamer/1"))
    files = list(tmp_path.glob("*.html"))
    assert ok is True and len(files) == 1
    assert "Cocody" in files[0].read_text(encoding="utf-8")
