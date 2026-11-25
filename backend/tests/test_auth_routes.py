"""Tests des routes d'authentification et de profil."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from tests.conftest import PASSWORD, auth, make_user

API = settings.API_PREFIX


def test_register_logs_in_and_sets_refresh_cookie(client: TestClient) -> None:
    response = client.post(f"{API}/auth/register", json={
        "email": "Nouveau@Orea.ci", "password": "Secret1234", "full_name": "Awa Diallo"})
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "nouveau@orea.ci"
    assert body["user"]["role"] == "user"
    assert "password_hash" not in body["user"]
    assert settings.REFRESH_COOKIE_NAME in response.cookies


def test_register_rejects_duplicate_email(client: TestClient, db: Session) -> None:
    make_user(db, "deja@orea.ci")
    response = client.post(f"{API}/auth/register", json={
        "email": "deja@orea.ci", "password": "Secret1234", "full_name": "Awa"})
    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_TAKEN"


def test_register_validation_messages_are_in_french(client: TestClient) -> None:
    response = client.post(f"{API}/auth/register", json={
        "email": "pas-un-email", "password": "court", "full_name": "A"})
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert body["message"] == "Quelques champs sont à corriger."
    assert set(body["fields"]) == {"email", "password", "full_name"}


def test_password_needs_letters_and_digits(client: TestClient) -> None:
    response = client.post(f"{API}/auth/register", json={
        "email": "a@orea.ci", "password": "seulementdeslettres", "full_name": "Awa"})
    assert response.status_code == 422
    assert "chiffre" in response.json()["fields"]["password"]


def test_login_and_me(client: TestClient, db: Session) -> None:
    make_user(db, "awa@orea.ci", name="Awa Diallo")
    response = client.post(f"{API}/auth/login",
                           json={"email": "AWA@orea.ci", "password": PASSWORD})
    assert response.status_code == 200
    token = response.json()["access_token"]

    me = client.get(f"{API}/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["full_name"] == "Awa Diallo"


def test_login_wrong_password(client: TestClient, db: Session) -> None:
    make_user(db, "awa@orea.ci")
    response = client.post(f"{API}/auth/login",
                           json={"email": "awa@orea.ci", "password": "mauvais123"})
    assert response.status_code == 401
    assert response.json()["message"] == "E-mail ou mot de passe incorrect."


def test_unknown_email_gives_same_message(client: TestClient) -> None:
    response = client.post(f"{API}/auth/login",
                           json={"email": "inconnu@orea.ci", "password": "mauvais123"})
    assert response.status_code == 401
    assert response.json()["message"] == "E-mail ou mot de passe incorrect."


def test_refresh_rotates_token_and_detects_reuse(client: TestClient, db: Session) -> None:
    make_user(db, "awa@orea.ci")
    client.post(f"{API}/auth/login", json={"email": "awa@orea.ci", "password": PASSWORD})
    first_cookie = client.cookies.get(settings.REFRESH_COOKIE_NAME)

    rotated = client.post(f"{API}/auth/refresh")
    assert rotated.status_code == 200
    assert client.cookies.get(settings.REFRESH_COOKIE_NAME) != first_cookie

    # Rejouer l'ancien jeton : vol présumé → refus et fermeture de toutes les sessions.
    client.cookies.clear()
    replay = client.post(f"{API}/auth/refresh",
                         headers={"Cookie": f"{settings.REFRESH_COOKIE_NAME}={first_cookie}"})
    assert replay.status_code == 401
    assert replay.json()["code"] == "TOKEN_REUSED"


def test_logout_revokes_refresh_token(client: TestClient, db: Session) -> None:
    make_user(db, "awa@orea.ci")
    client.post(f"{API}/auth/login", json={"email": "awa@orea.ci", "password": PASSWORD})
    cookie = client.cookies.get(settings.REFRESH_COOKIE_NAME)
    assert client.post(f"{API}/auth/logout").status_code == 200
    client.cookies.clear()
    again = client.post(f"{API}/auth/refresh",
                        headers={"Cookie": f"{settings.REFRESH_COOKIE_NAME}={cookie}"})
    assert again.status_code == 401


def test_protected_route_requires_token(client: TestClient) -> None:
    response = client.get(f"{API}/users/me")
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_disabled_account_is_rejected(client: TestClient, db: Session) -> None:
    user = make_user(db, "bloque@orea.ci")
    user.is_active = False
    db.commit()
    assert client.get(f"{API}/users/me", headers=auth(user)).status_code == 401


def test_login_is_rate_limited(client: TestClient) -> None:
    codes = [
        client.post(f"{API}/auth/login",
                    json={"email": "x@orea.ci", "password": "mauvais123"}).status_code
        for _ in range(12)
    ]
    assert codes[-1] == 429
