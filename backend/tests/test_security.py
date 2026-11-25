"""Tests du hachage des numéros, des mots de passe et des jetons."""

import uuid

import jwt
import pytest

from app.core import security
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_doc_number,
    hash_password,
    normalize_doc_number,
    verify_doc_number,
    verify_password,
)


def test_doc_number_normalization() -> None:
    assert normalize_doc_number(" ci 0099-1234.56 ") == "CI0099123456"


def test_doc_number_hash_is_sha256_hex_and_never_the_number() -> None:
    digest = hash_doc_number("CI0099123456")
    assert len(digest) == 64
    assert all(c in "0123456789abcdef" for c in digest)
    assert "0099123456" not in digest


def test_doc_number_hash_ignores_formatting() -> None:
    assert hash_doc_number("CI 0099 1234 56") == hash_doc_number("ci0099123456")


def test_doc_number_verification() -> None:
    stored = hash_doc_number("CI0099123456")
    assert verify_doc_number("ci 0099 1234 56", stored)
    assert not verify_doc_number("CI0099123457", stored)


def test_hash_depends_on_secret_pepper(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sans la clé secrète, impossible de recalculer les empreintes (attaque par
    dictionnaire sur une copie de la base)."""
    original = hash_doc_number("CI0099123456")
    monkeypatch.setattr(security.settings, "DOC_NUMBER_PEPPER", "une-autre-cle")
    assert hash_doc_number("CI0099123456") != original


def test_password_hashing() -> None:
    hashed = hash_password("Abidjan2025")
    assert hashed.startswith("$2b$")
    assert verify_password("Abidjan2025", hashed)
    assert not verify_password("abidjan2025", hashed)


def test_access_and_refresh_tokens_are_not_interchangeable() -> None:
    user_id = uuid.uuid4()
    access, ttl = create_access_token(user_id, "user")
    refresh, jti, _ = create_refresh_token(user_id)

    assert ttl == settings.ACCESS_TOKEN_MINUTES * 60
    assert decode_token(access, "access")["sub"] == str(user_id)
    assert decode_token(refresh, "refresh")["jti"] == jti
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(refresh, "access")
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(access, "refresh")


def test_tampered_token_is_rejected() -> None:
    access, _ = create_access_token(uuid.uuid4(), "user")
    with pytest.raises(jwt.PyJWTError):
        decode_token(access[:-2] + "xx", "access")
