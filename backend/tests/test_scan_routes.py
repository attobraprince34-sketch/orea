"""Tests du parcours photo : scan → photo floutée → déclaration → accès restreint."""

import os
import time
from collections.abc import Iterator
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import RelayPoint, User
from app.services import ocr_service, photo_storage
from app.services.ocr_service import OcrUnavailable
from tests.conftest import auth, found_payload, make_user
from tests.ocr_fixtures import CNI_BOXES, FakeEngine

API = settings.API_PREFIX
SPECIMEN = Path(__file__).resolve().parent.parent / "specimens" / "specimen_cni.jpg"


@pytest.fixture
def engine() -> Iterator[FakeEngine]:
    fake = FakeEngine(CNI_BOXES)
    ocr_service.set_engine(fake)
    yield fake
    ocr_service.set_engine(None)


def upload(client: TestClient, user: User, data: bytes | None = None,
           content_type: str = "image/jpeg"):
    files = {"file": ("photo.jpg", data if data is not None else SPECIMEN.read_bytes(),
                      content_type)}
    return client.post(f"{API}/ocr/scan", files=files, headers=auth(user))


def sharpness(image: np.ndarray) -> float:
    return float(cv2.Laplacian(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())


def test_scan_prefills_the_form(client: TestClient, finder: User, engine: FakeEngine) -> None:
    response = upload(client, finder)
    assert response.status_code == 200, response.json()
    body = response.json()

    assert body["ocr_available"] is True
    assert body["fields"]["doc_type"]["value"] == "cni"
    assert body["fields"]["holder_name"]["value"] == "KOUASSI AYA MARIE"
    assert body["fields"]["document_number"]["value"] == "CI 0099 1234 56"
    # Champ lu avec peu de confiance : signalé « à vérifier ».
    assert body["fields"]["birth_date"]["needs_review"] is True
    assert body["fields"]["surname"]["needs_review"] is False
    assert body["preview"].startswith("data:image/jpeg;base64,")
    assert body["blurred_regions"] >= 5
    assert len(body["upload_id"]) == 32


def test_stored_photo_is_blurred_where_the_number_was(
    client: TestClient, finder: User, engine: FakeEngine
) -> None:
    upload_id = upload(client, finder).json()["upload_id"]
    stored_path = Path(settings.MEDIA_DIR) / "pending" / str(finder.id) / f"{upload_id}.jpg"
    stored = cv2.imread(str(stored_path))
    original = cv2.imread(str(SPECIMEN))
    assert stored.shape == original.shape

    number_zone = (slice(423, 457), slice(330, 580))  # « CI 0099 1234 56 »
    title_zone = (slice(66, 102), slice(84, 600))  # « CARTE NATIONALE D'IDENTITÉ »
    assert sharpness(stored[number_zone]) < sharpness(original[number_zone]) / 5
    # Les en-têtes restent lisibles pour l'agent du point relais.
    assert sharpness(stored[title_zone]) > sharpness(original[title_zone]) / 2


def test_photo_is_attached_to_the_declaration_and_kept_private(
    client: TestClient, db: Session, finder: User, owner: User, agent: User,
    admin: User, relay: RelayPoint, engine: FakeEngine,
) -> None:
    upload_id = upload(client, finder).json()["upload_id"]
    created = client.post(f"{API}/found", json=found_payload(relay, upload_id=upload_id),
                          headers=auth(finder))
    assert created.status_code == 201
    found = created.json()["declaration"]
    assert found["has_photo"] is True

    photo_url = f"{API}/found/{found['id']}/photo"
    for allowed in (finder, agent, admin):
        response = client.get(photo_url, headers=auth(allowed))
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/jpeg"
        assert "no-store" in response.headers["cache-control"]
    assert client.get(photo_url, headers=auth(owner)).status_code == 403
    assert client.get(photo_url).status_code == 401

    # Aucune route publique n'expose la photo.
    assert "photo" not in str(client.get(f"{API}/search").json())


def test_upload_cannot_be_reused_or_stolen(
    client: TestClient, db: Session, finder: User, relay: RelayPoint, engine: FakeEngine
) -> None:
    upload_id = upload(client, finder).json()["upload_id"]

    thief = make_user(db, "voleur@orea.ci")
    stolen = client.post(f"{API}/found", headers=auth(thief), json=found_payload(
        relay, upload_id=upload_id, document_number="CI 1111 2222 33"))
    assert stolen.status_code == 400 and stolen.json()["code"] == "UPLOAD_EXPIRED"

    client.post(f"{API}/found", json=found_payload(relay, upload_id=upload_id),
                headers=auth(finder))
    again = client.post(f"{API}/found", headers=auth(finder), json=found_payload(
        relay, upload_id=upload_id, document_number="CI 4444 5555 66"))
    assert again.json()["code"] == "UPLOAD_EXPIRED"


def test_path_traversal_is_impossible(
    client: TestClient, finder: User, relay: RelayPoint
) -> None:
    response = client.post(f"{API}/found", headers=auth(finder),
                           json=found_payload(relay, upload_id="../../etc/passwd"))
    assert response.status_code == 400 and response.json()["code"] == "UPLOAD_INVALID"


def test_without_ocr_the_photo_is_not_kept(client: TestClient, finder: User) -> None:
    class BrokenEngine:
        def read(self, image: np.ndarray) -> list:
            raise OcrUnavailable("modèle absent")

    ocr_service.set_engine(BrokenEngine())
    try:
        body = upload(client, finder).json()
    finally:
        ocr_service.set_engine(None)
    assert body["ocr_available"] is False
    assert body["upload_id"] is None and body["preview"] is None
    assert "à la main" in body["message"]


def test_invalid_uploads_are_refused(client: TestClient, finder: User,
                                     engine: FakeEngine) -> None:
    pdf = upload(client, finder, b"%PDF-1.4", content_type="application/pdf")
    assert pdf.status_code == 400 and pdf.json()["code"] == "IMAGE_FORMAT"

    garbage = upload(client, finder, b"pas une image")
    assert garbage.status_code == 400 and garbage.json()["code"] == "IMAGE_UNREADABLE"
    assert engine.calls == 0


def test_too_large_upload(client: TestClient, finder: User, engine: FakeEngine,
                          monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "OCR_MAX_UPLOAD_MB", 0)
    response = upload(client, finder)
    assert response.status_code == 400 and response.json()["code"] == "IMAGE_TOO_LARGE"


def test_scan_requires_login(client: TestClient) -> None:
    files = {"file": ("photo.jpg", SPECIMEN.read_bytes(), "image/jpeg")}
    assert client.post(f"{API}/ocr/scan", files=files).status_code == 401


def test_orphan_photos_are_purged(client: TestClient, finder: User, engine: FakeEngine) -> None:
    upload_id = upload(client, finder).json()["upload_id"]
    path = Path(settings.MEDIA_DIR) / "pending" / str(finder.id) / f"{upload_id}.jpg"
    two_hours_ago = time.time() - 7200
    os.utime(path, (two_hours_ago, two_hours_ago))

    assert photo_storage.purge_pending() >= 1
    assert not path.exists()
