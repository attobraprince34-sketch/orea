"""Primitives de sécurité : mots de passe, JWT, hachage des numéros de pièce.

Règle d'or d'Orea : un numéro de pièce n'est JAMAIS stocké en clair. On conserve
uniquement HMAC-SHA256(clé secrète, numéro normalisé), et la vérification compare
deux empreintes en temps constant.
"""

import hashlib
import hmac
import re
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import bcrypt
import jwt

from app.core.config import settings

TokenType = Literal["access", "refresh"]

# bcrypt n'utilise que les 72 premiers octets d'un mot de passe : on tronque
# explicitement pour éviter toute erreur avec les mots de passe longs.
_BCRYPT_MAX_BYTES = 72


# ------------------------------------------------------------------------------
# Mots de passe
# ------------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:_BCRYPT_MAX_BYTES], bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:_BCRYPT_MAX_BYTES], password_hash.encode())
    except ValueError:
        return False


# ------------------------------------------------------------------------------
# Jetons JWT
# ------------------------------------------------------------------------------
def _encode(payload: dict[str, Any]) -> str:
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: uuid.UUID, role: str) -> tuple[str, int]:
    """Crée un jeton d'accès court. Renvoie (jeton, durée de vie en secondes)."""
    ttl = timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
    now = datetime.now(UTC)
    token = _encode(
        {"sub": str(user_id), "role": role, "type": "access", "iat": now, "exp": now + ttl}
    )
    return token, int(ttl.total_seconds())


def create_refresh_token(user_id: uuid.UUID) -> tuple[str, str, datetime]:
    """Crée un jeton de rafraîchissement. Renvoie (jeton, identifiant jti, expiration)."""
    now = datetime.now(UTC)
    expires_at = now + timedelta(days=settings.REFRESH_TOKEN_DAYS)
    jti = uuid.uuid4().hex
    token = _encode(
        {"sub": str(user_id), "type": "refresh", "jti": jti, "iat": now, "exp": expires_at}
    )
    return token, jti, expires_at


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    """Décode et valide un JWT. Lève jwt.PyJWTError si le jeton est invalide."""
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("Type de jeton inattendu")
    return payload


# ------------------------------------------------------------------------------
# Numéros de pièce
# ------------------------------------------------------------------------------
_NON_ALNUM = re.compile(r"[^A-Z0-9]")


def normalize_doc_number(number: str) -> str:
    """« ci 0012-345 678 » → « CI0012345678 » : majuscules, sans espaces ni séparateurs."""
    return _NON_ALNUM.sub("", number.upper())


def hash_doc_number(number: str) -> str:
    """Empreinte HMAC-SHA256 du numéro normalisé (64 caractères hexadécimaux)."""
    normalized = normalize_doc_number(number)
    return hmac.new(
        settings.DOC_NUMBER_PEPPER.encode(), normalized.encode(), hashlib.sha256
    ).hexdigest()


def verify_doc_number(number: str, expected_hash: str) -> bool:
    """Compare en temps constant pour ne rien laisser deviner par le temps de réponse."""
    return hmac.compare_digest(hash_doc_number(number), expected_hash)


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
