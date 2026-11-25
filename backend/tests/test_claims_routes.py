"""Tests du parcours complet : réclamation → QR code → restitution au point relais."""

import uuid
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import utcnow
from app.models import Claim, FoundDocument, LostReport, PickupCode, RelayPoint, User
from app.models.enums import ClaimStatus, Commune, DeclarationStatus, Role
from app.services import expiry_service
from tests.conftest import CNI_NUMBER, auth, found_payload, lost_payload, make_relay, make_user

API = settings.API_PREFIX


@pytest.fixture
def found_id(client: TestClient, finder: User, owner: User, relay: RelayPoint) -> str:
    """Une perte déclarée, puis la pièce correspondante trouvée et déposée."""
    client.post(f"{API}/lost", json=lost_payload(), headers=auth(owner))
    return client.post(f"{API}/found", json=found_payload(relay),
                       headers=auth(finder)).json()["declaration"]["id"]


def claim(client: TestClient, user: User, found_id: str, number: str = CNI_NUMBER):
    return client.post(f"{API}/claims", json={"found_document_id": found_id,
                                              "document_number": number}, headers=auth(user))


def test_full_return_journey(
    client: TestClient, db: Session, owner: User, agent: User, finder: User, found_id: str
) -> None:
    # 1. Le propriétaire prouve son identité (numéro saisi avec une autre mise en forme).
    response = claim(client, owner, found_id, number="ci0099123456")
    assert response.status_code == 201, response.json()
    pickup = response.json()["pickup"]
    assert pickup["qr_payload"].startswith("OREA1.")
    assert pickup["used_at"] is None

    # 2. Le QR code est téléchargeable par son propriétaire uniquement.
    claim_id = response.json()["id"]
    png = client.get(f"{API}/claims/{claim_id}/qr.png", headers=auth(owner))
    assert png.status_code == 200 and png.headers["content-type"] == "image/png"
    assert client.get(f"{API}/claims/{claim_id}/qr.png", headers=auth(finder)).status_code == 404

    # 3. Le point relais confirme la réception de la pièce.
    received = client.post(f"{API}/relay/documents/{found_id}/receive", headers=auth(agent))
    assert received.status_code == 200 and received.json()["received_at"]

    # 4. Scan : aperçu sans consommer le QR.
    preview = client.post(f"{API}/relay/pickup/verify", json={"code": pickup["qr_payload"]},
                          headers=auth(agent))
    assert preview.status_code == 200
    assert preview.json()["claimant_name"] == owner.full_name

    # 5. Validation de la restitution.
    done = client.post(f"{API}/relay/pickup/confirm", json={"code": pickup["qr_payload"]},
                       headers=auth(agent))
    assert done.status_code == 200

    db.expire_all()
    found = db.get(FoundDocument, uuid.UUID(found_id))
    lost = db.scalar(select(LostReport))
    assert found is not None and found.status == DeclarationStatus.RETURNED
    assert lost is not None and lost.status == DeclarationStatus.RETURNED

    # 6. Le QR est à usage unique.
    reuse = client.post(f"{API}/relay/pickup/confirm", json={"code": pickup["qr_payload"]},
                        headers=auth(agent))
    assert reuse.status_code == 409 and reuse.json()["code"] == "QR_ALREADY_USED"

    stats = client.get(f"{API}/stats/public").json()
    assert stats["documents_returned"] == 1 and stats["success_rate"] == 100.0


def test_short_backup_code_works(
    client: TestClient, owner: User, agent: User, found_id: str
) -> None:
    short = claim(client, owner, found_id).json()["pickup"]["short_code"]
    client.post(f"{API}/relay/documents/{found_id}/receive", headers=auth(agent))
    response = client.post(f"{API}/relay/pickup/verify", json={"code": short.lower()},
                           headers=auth(agent))
    assert response.status_code == 200


def test_wrong_number_then_lock_after_max_attempts(
    client: TestClient, owner: User, found_id: str
) -> None:
    # La limite d'IP (5 / 15 min) est désactivée ici pour tester la règle métier seule.
    from app.core.rate_limit import limiter

    limiter.enabled = False
    try:
        first = claim(client, owner, found_id, number="CI0000000000")
        assert first.status_code == 400
        assert first.json()["code"] == "NUMBER_MISMATCH"
        assert first.json()["remaining_attempts"] == settings.CLAIM_MAX_ATTEMPTS - 1

        for _ in range(settings.CLAIM_MAX_ATTEMPTS - 2):
            claim(client, owner, found_id, number="CI0000000000")
        last = claim(client, owner, found_id, number="CI0000000000")
        assert last.status_code == 429 and last.json()["code"] == "CLAIM_LOCKED"

        # Même le bon numéro est refusé pendant le verrouillage.
        locked = claim(client, owner, found_id)
        assert locked.status_code == 429
    finally:
        limiter.enabled = True


def test_claim_endpoint_is_rate_limited_by_ip(
    client: TestClient, owner: User, found_id: str
) -> None:
    codes = [claim(client, owner, found_id, number="CI0000000000").status_code
             for _ in range(6)]
    assert codes[-1] == 429


def test_finder_cannot_claim_own_find(client: TestClient, finder: User, found_id: str) -> None:
    response = claim(client, finder, found_id)
    assert response.status_code == 403 and response.json()["code"] == "OWN_DECLARATION"


def test_second_claim_is_refused(
    client: TestClient, db: Session, owner: User, found_id: str
) -> None:
    assert claim(client, owner, found_id).status_code == 201
    other = make_user(db, "autre@orea.ci")
    assert claim(client, other, found_id).json()["code"] == "ALREADY_CLAIMED"
    assert claim(client, owner, found_id).json()["code"] == "ALREADY_CLAIMED_BY_YOU"


def test_pickup_requires_reception_first(
    client: TestClient, owner: User, agent: User, found_id: str
) -> None:
    payload = claim(client, owner, found_id).json()["pickup"]["qr_payload"]
    response = client.post(f"{API}/relay/pickup/verify", json={"code": payload},
                           headers=auth(agent))
    assert response.status_code == 409 and response.json()["code"] == "NOT_RECEIVED"


def test_other_relay_cannot_validate(
    client: TestClient, db: Session, owner: User, agent: User, found_id: str
) -> None:
    payload = claim(client, owner, found_id).json()["pickup"]["qr_payload"]
    client.post(f"{API}/relay/documents/{found_id}/receive", headers=auth(agent))
    abobo = make_relay(db, "Mairie d'Abobo", Commune.ABOBO)
    other_agent = make_user(db, "agent2@orea.ci", Role.RELAY, abobo)
    response = client.post(f"{API}/relay/pickup/confirm", json={"code": payload},
                           headers=auth(other_agent))
    assert response.status_code == 403 and response.json()["code"] == "QR_WRONG_RELAY"


def test_expired_qr_is_refused_and_document_reopens(
    client: TestClient, db: Session, owner: User, agent: User, found_id: str
) -> None:
    payload = claim(client, owner, found_id).json()["pickup"]["qr_payload"]
    client.post(f"{API}/relay/documents/{found_id}/receive", headers=auth(agent))

    code = db.scalar(select(PickupCode))
    assert code is not None
    code.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()

    response = client.post(f"{API}/relay/pickup/verify", json={"code": payload},
                           headers=auth(agent))
    assert response.status_code == 409 and response.json()["code"] == "QR_EXPIRED"

    # La tâche planifiée expire la réclamation et rend la pièce de nouveau réclamable.
    result = expiry_service.run_once(db)
    assert result["pickup_codes"] == 1
    db.expire_all()
    assert db.scalar(select(Claim)).status == ClaimStatus.EXPIRED  # type: ignore[union-attr]
    assert db.get(FoundDocument, uuid.UUID(found_id)).status == DeclarationStatus.MATCHED  # type: ignore[union-attr]
    assert claim(client, owner, found_id).status_code == 201


def test_qr_expires_after_14_days(client: TestClient, owner: User, found_id: str) -> None:
    from datetime import datetime

    expires = claim(client, owner, found_id).json()["pickup"]["expires_at"]
    delta = datetime.fromisoformat(expires) - utcnow()
    assert timedelta(days=13, hours=23) < delta <= timedelta(days=14)


def test_unknown_or_foreign_qr(client: TestClient, agent: User) -> None:
    unknown = client.post(f"{API}/relay/pickup/verify",
                          json={"code": "OREA1." + "x" * 43}, headers=auth(agent))
    assert unknown.status_code == 404
    foreign = client.post(f"{API}/relay/pickup/verify",
                          json={"code": "https://exemple.com"}, headers=auth(agent))
    assert foreign.status_code == 400 and foreign.json()["code"] == "QR_INVALID"


def test_relay_space_is_reserved(client: TestClient, owner: User) -> None:
    response = client.get(f"{API}/relay/documents", headers=auth(owner))
    assert response.status_code == 403


def test_relay_lists_its_documents(
    client: TestClient, agent: User, found_id: str
) -> None:
    awaiting = client.get(f"{API}/relay/documents", params={"awaiting_reception": True},
                          headers=auth(agent)).json()
    assert [d["id"] for d in awaiting] == [found_id]
    # Les agents voient le nom complet pour vérifier la pièce physique.
    assert awaiting[0]["holder_name"] == "KOUASSI Aya Marie"


def test_notifications_follow_the_journey(
    client: TestClient, owner: User, found_id: str
) -> None:
    claim(client, owner, found_id)
    body = client.get(f"{API}/notifications", headers=auth(owner)).json()
    assert body["unread"] == 2  # correspondance + QR prêt
    titles = [n["title"] for n in body["items"]]
    assert "C'est confirmé, ton QR code est prêt !" in titles

    client.post(f"{API}/notifications/read-all", headers=auth(owner))
    assert client.get(f"{API}/notifications", headers=auth(owner)).json()["unread"] == 0


def test_reception_notifies_owner_with_correct_casing(
    client: TestClient, db: Session, owner: User, agent: User, found_id: str
) -> None:
    from app.models import Notification

    client.post(f"{API}/relay/documents/{found_id}/receive", headers=auth(agent))
    titles = list(db.scalars(select(Notification.title).where(Notification.user_id == owner.id)))
    # « Ta CNI » et non « Ta cni » (piège de str.capitalize).
    assert "Ta CNI est arrivée à Cocody !" in titles
