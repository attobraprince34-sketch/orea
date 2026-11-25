"""Tests des déclarations, de la correspondance automatique et de la recherche publique."""

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import FoundDocument, Notification, RelayPoint, User
from app.models.enums import DeclarationStatus, NotificationKind
from tests.conftest import CNI_NUMBER, auth, found_payload, lost_payload, make_relay

API = settings.API_PREFIX


def test_declare_found_stores_only_the_number_hash(
    client: TestClient, db: Session, finder: User, relay: RelayPoint
) -> None:
    response = client.post(f"{API}/found", json=found_payload(relay), headers=auth(finder))
    assert response.status_code == 201
    body = response.json()
    assert body["matches_found"] == 0
    assert body["declaration"]["status"] == "pending"
    assert body["declaration"]["holder_initials"] == "K. A. M."
    assert "number_hash" not in body["declaration"]
    assert "document_number" not in body["declaration"]

    stored = db.scalar(select(FoundDocument))
    assert stored is not None
    assert "0099" not in stored.number_hash
    assert len(stored.number_hash) == 64


def test_lost_then_found_triggers_a_match_with_inverted_names(
    client: TestClient, db: Session, finder: User, owner: User, relay: RelayPoint
) -> None:
    lost = client.post(f"{API}/lost", json=lost_payload(), headers=auth(owner))
    assert lost.status_code == 201 and lost.json()["matches_found"] == 0

    found = client.post(f"{API}/found", json=found_payload(relay), headers=auth(finder))
    assert found.json()["matches_found"] == 1
    assert found.json()["declaration"]["status"] == "matched"

    mine = client.get(f"{API}/lost/mine", headers=auth(owner)).json()
    assert mine[0]["status"] == "matched"
    assert mine[0]["matches"][0]["relay_point"]["commune_label"] == "Cocody"

    note = db.scalar(select(Notification).where(Notification.user_id == owner.id))
    assert note is not None and note.kind == NotificationKind.MATCH
    assert note.title == "Bonne nouvelle, ta CNI t'attend à Cocody !"


def test_found_then_lost_triggers_a_match_too(
    client: TestClient, finder: User, owner: User, relay: RelayPoint
) -> None:
    client.post(f"{API}/found", json=found_payload(relay), headers=auth(finder))
    lost = client.post(f"{API}/lost", json=lost_payload(holder_name="Kouasi Aya Mari"),
                       headers=auth(owner))
    assert lost.json()["matches_found"] == 1


def test_no_match_for_other_doc_type_or_other_person(
    client: TestClient, finder: User, owner: User, relay: RelayPoint
) -> None:
    client.post(f"{API}/found", json=found_payload(relay), headers=auth(finder))
    passport = client.post(f"{API}/lost", json=lost_payload(doc_type="passeport"),
                           headers=auth(owner))
    stranger = client.post(f"{API}/lost", json=lost_payload(holder_name="Traoré Ibrahim",
                                                             birth_date=None),
                           headers=auth(owner))
    assert passport.json()["matches_found"] == 0
    assert stranger.json()["matches_found"] == 0


def test_plateau_uses_the_right_preposition(
    client: TestClient, db: Session, finder: User, owner: User
) -> None:
    from app.models.enums import Commune

    plateau = make_relay(db, "Commissariat du Plateau", Commune.PLATEAU)
    client.post(f"{API}/lost", json=lost_payload(doc_type="passeport"), headers=auth(owner))
    client.post(f"{API}/found", json=found_payload(plateau, doc_type="passeport"),
                headers=auth(finder))
    note = db.scalar(select(Notification).where(Notification.user_id == owner.id))
    assert note is not None
    assert note.title == "Bonne nouvelle, ton passeport t'attend au Plateau !"


def test_same_document_cannot_be_declared_twice(
    client: TestClient, finder: User, owner: User, relay: RelayPoint
) -> None:
    client.post(f"{API}/found", json=found_payload(relay), headers=auth(finder))
    again = client.post(f"{API}/found", json=found_payload(relay, holder_name="Kouassi A."),
                        headers=auth(owner))
    assert again.status_code == 409
    assert again.json()["code"] == "ALREADY_DECLARED"


def test_future_date_is_refused(client: TestClient, finder: User, relay: RelayPoint) -> None:
    response = client.post(f"{API}/found", json=found_payload(relay, found_on="2999-01-01"),
                           headers=auth(finder))
    assert response.status_code == 422
    assert "futur" in response.json()["fields"]["found_on"]


def test_public_search_is_anonymised(
    client: TestClient, finder: User, relay: RelayPoint
) -> None:
    client.post(f"{API}/found", json=found_payload(relay), headers=auth(finder))
    results = client.get(f"{API}/search", params={"name": "aya kouassi"}).json()

    assert len(results) == 1
    item = results[0]
    assert set(item) == {"id", "doc_type", "doc_type_label", "holder_initials", "commune",
                         "commune_label", "found_on", "score"}
    assert item["holder_initials"] == "K. A. M."
    serialized = str(results).lower()
    assert "kouassi" not in serialized and "aya" not in serialized


def test_public_search_filters(client: TestClient, finder: User, relay: RelayPoint) -> None:
    client.post(f"{API}/found", json=found_payload(relay), headers=auth(finder))
    assert len(client.get(f"{API}/search", params={"doc_type": "cni"}).json()) == 1
    assert client.get(f"{API}/search", params={"doc_type": "permis"}).json() == []
    assert client.get(f"{API}/search", params={"commune": "abobo"}).json() == []
    assert client.get(f"{API}/search", params={"name": "Traoré Ibrahim"}).json() == []


def test_public_search_is_rate_limited(client: TestClient) -> None:
    codes = [client.get(f"{API}/search").status_code for _ in range(31)]
    assert codes[:30] == [200] * 30
    assert codes[30] == 429


def test_cancel_lost_report(client: TestClient, owner: User) -> None:
    lost_id = client.post(f"{API}/lost", json=lost_payload(),
                          headers=auth(owner)).json()["declaration"]["id"]
    response = client.delete(f"{API}/lost/{lost_id}", headers=auth(owner))
    assert response.status_code == 200
    assert response.json()["status"] == DeclarationStatus.CANCELLED.value


def test_found_details_are_private(
    client: TestClient, finder: User, owner: User, relay: RelayPoint
) -> None:
    found_id = client.post(f"{API}/found", json=found_payload(relay),
                           headers=auth(finder)).json()["declaration"]["id"]
    assert client.get(f"{API}/found/{found_id}", headers=auth(finder)).status_code == 200
    assert client.get(f"{API}/found/{found_id}", headers=auth(owner)).status_code == 403


def test_public_metadata_and_relay_points(client: TestClient, relay: RelayPoint) -> None:
    assert len(client.get(f"{API}/meta/communes").json()) == 13
    assert len(client.get(f"{API}/meta/doc-types").json()) == 6
    points = client.get(f"{API}/relay-points").json()
    assert points[0]["name"] == "Mairie de Cocody"
    assert {"latitude", "longitude", "opening_hours"} <= set(points[0])


def test_number_is_never_logged_in_clear(
    client: TestClient, db: Session, finder: User, relay: RelayPoint
) -> None:
    from app.models import AuditLog

    client.post(f"{API}/found", json=found_payload(relay), headers=auth(finder))
    for entry in db.scalars(select(AuditLog)):
        assert CNI_NUMBER.replace(" ", "") not in str(entry.meta)


def test_match_is_explained_without_revealing_data(
    client: TestClient, finder: User, owner: User, relay: RelayPoint
) -> None:
    client.post(f"{API}/lost", json=lost_payload(), headers=auth(owner))
    client.post(f"{API}/found", json=found_payload(relay), headers=auth(finder))
    reasons = client.get(f"{API}/lost/mine", headers=auth(owner)).json()[0]["matches"][0]["reasons"]
    assert "Mêmes noms, dans un ordre différent" in reasons
    assert "Même date de naissance" in reasons
    assert "Perdue et retrouvée dans la même commune" in reasons
    assert "1998" not in str(reasons)  # on dit QUE ça concorde, jamais la valeur


def test_public_activity_feed_is_anonymous(
    client: TestClient, finder: User, owner: User, relay: RelayPoint
) -> None:
    client.post(f"{API}/lost", json=lost_payload(), headers=auth(owner))
    client.post(f"{API}/found", json=found_payload(relay), headers=auth(finder))
    feed = client.get(f"{API}/stats/activity").json()
    assert {e["kind"] for e in feed} == {"found", "match"}
    assert feed[0]["commune_label"] == "Cocody"
    assert "kouassi" not in str(feed).lower() and "K. A." not in str(feed)
