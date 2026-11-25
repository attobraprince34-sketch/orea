"""Tests de la génération et de la lecture des QR codes."""

import uuid

import pytest

from app.services import qr_service


def test_token_is_deterministic_for_same_code() -> None:
    code_id, nonce = uuid.uuid4(), qr_service.new_nonce()
    assert qr_service.derive_token(code_id, nonce) == qr_service.derive_token(code_id, nonce)


def test_tokens_are_unique() -> None:
    tokens = {qr_service.derive_token(uuid.uuid4(), qr_service.new_nonce()) for _ in range(500)}
    assert len(tokens) == 500


def test_token_depends_on_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    code_id, nonce = uuid.uuid4(), "abc"
    original = qr_service.derive_token(code_id, nonce)
    monkeypatch.setattr(qr_service.settings, "QR_SECRET", "autre-secret")
    assert qr_service.derive_token(code_id, nonce) != original


def test_short_code_format() -> None:
    short = qr_service.short_code_from_token(qr_service.derive_token(uuid.uuid4(), "n"))
    assert len(short) == 14 and short[4] == "-" and short[9] == "-"
    assert not set(short.replace("-", "")) & set("01ILO")  # pas de caractère ambigu


def test_lookup_accepts_payload_and_short_code() -> None:
    token = qr_service.derive_token(uuid.uuid4(), "n")
    short = qr_service.short_code_from_token(token)

    kind, digest = qr_service.lookup_hashes(qr_service.payload_from_token(token)) or ("", "")
    assert kind == "token" and digest == qr_service.token_hash(token)

    # Le code de secours est tolérant : minuscules, sans tirets, espaces autour.
    kind, digest = qr_service.lookup_hashes(f"  {short.lower().replace('-', '')} ") or ("", "")
    assert kind == "short" and digest == qr_service.short_code_hash(short)


@pytest.mark.parametrize("garbage", ["https://exemple.com", "12345678", "OREA1.court"])
def test_lookup_rejects_foreign_codes(garbage: str) -> None:
    assert qr_service.lookup_hashes(garbage) is None


def test_png_is_a_valid_image() -> None:
    png = qr_service.make_png("OREA1.test-payload")
    assert png.startswith(b"\x89PNG\r\n\x1a\n")
    assert len(png) > 300
