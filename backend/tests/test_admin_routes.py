"""Tests de l'espace administrateur."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import RelayPoint, User
from tests.conftest import auth, found_payload, lost_payload

API = settings.API_PREFIX


def test_admin_routes_are_reserved(client: TestClient, owner: User, agent: User) -> None:
    for user in (owner, agent):
        response = client.get(f"{API}/admin/stats", headers=auth(user))
        assert response.status_code == 403
        assert response.json()["code"] == "ROLE_REQUIRED"


def test_admin_stats(
    client: TestClient, admin: User, finder: User, owner: User, relay: RelayPoint
) -> None:
    client.post(f"{API}/lost", json=lost_payload(), headers=auth(owner))
    client.post(f"{API}/found", json=found_payload(relay), headers=auth(finder))

    stats = client.get(f"{API}/admin/stats", headers=auth(admin)).json()
    assert stats["documents_found"] == 1
    assert stats["lost_reports"] == 1
    assert stats["matches"] == 1
    assert stats["by_commune"][0] == {"key": "cocody", "label": "Cocody", "count": 1}
    assert len(stats["timeline"]) == 30
    assert stats["timeline"][-1]["found"] == 1


def test_admin_manages_relay_points(client: TestClient, admin: User) -> None:
    created = client.post(f"{API}/admin/relay-points", headers=auth(admin), json={
        "name": "Mairie de Yopougon", "commune": "yopougon", "address": "Place de la mairie",
        "latitude": 5.34, "longitude": -4.08})
    assert created.status_code == 201
    relay_id = created.json()["id"]

    client.patch(f"{API}/admin/relay-points/{relay_id}", headers=auth(admin),
                 json={"opening_hours": "Lun–Sam · 8h–18h"})
    client.delete(f"{API}/admin/relay-points/{relay_id}", headers=auth(admin))

    assert client.get(f"{API}/relay-points").json() == []  # désactivé : hors de la carte
    all_points = client.get(f"{API}/admin/relay-points", headers=auth(admin)).json()
    assert all_points[0]["opening_hours"] == "Lun–Sam · 8h–18h"


def test_relay_point_must_be_in_abidjan(client: TestClient, admin: User) -> None:
    response = client.post(f"{API}/admin/relay-points", headers=auth(admin), json={
        "name": "Hors zone", "commune": "cocody", "address": "Paris", "latitude": 48.8,
        "longitude": 2.35})
    assert response.status_code == 422


def test_admin_promotes_user_to_relay_agent(
    client: TestClient, db: Session, admin: User, owner: User, relay: RelayPoint
) -> None:
    missing = client.patch(f"{API}/admin/users/{owner.id}", headers=auth(admin),
                           json={"role": "relay"})
    assert missing.status_code == 400 and missing.json()["code"] == "RELAY_POINT_REQUIRED"

    ok = client.patch(f"{API}/admin/users/{owner.id}", headers=auth(admin),
                      json={"role": "relay", "relay_point_id": str(relay.id)})
    assert ok.status_code == 200
    assert ok.json()["relay_point"]["name"] == relay.name


def test_admin_cannot_demote_self(client: TestClient, admin: User) -> None:
    response = client.patch(f"{API}/admin/users/{admin.id}", headers=auth(admin),
                            json={"role": "user"})
    assert response.status_code == 409


def test_users_search_and_pagination(client: TestClient, admin: User, owner: User) -> None:
    page = client.get(f"{API}/admin/users", params={"q": "proprio"}, headers=auth(admin)).json()
    assert page["total"] == 1 and page["items"][0]["email"] == owner.email


def test_moderation_is_audited(
    client: TestClient, admin: User, finder: User, relay: RelayPoint
) -> None:
    found_id = client.post(f"{API}/found", json=found_payload(relay),
                           headers=auth(finder)).json()["declaration"]["id"]
    response = client.patch(f"{API}/admin/declarations/found/{found_id}", headers=auth(admin),
                            json={"status": "cancelled", "reason": "Déclaration de test"})
    assert response.status_code == 200 and response.json()["status"] == "cancelled"

    queue = client.get(f"{API}/admin/declarations", params={"status": "cancelled"},
                       headers=auth(admin)).json()
    assert queue["total"] == 1

    audit = client.get(f"{API}/admin/audit", params={"action": "declaration.moderated"},
                       headers=auth(admin)).json()
    assert audit[0]["meta"]["reason"] == "Déclaration de test"

    # Une pièce modérée disparaît de la recherche publique.
    assert client.get(f"{API}/search").json() == []
