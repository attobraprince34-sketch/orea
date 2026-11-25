"""Inscription, connexion et cycle de vie des jetons."""

import uuid

import jwt
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.errors import Conflict, Unauthorized
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.base import utcnow
from app.models import RefreshToken, User
from app.models.enums import Role
from app.schemas.users import RegisterIn

INVALID_CREDENTIALS = "E-mail ou mot de passe incorrect."
SESSION_EXPIRED = "Ta session a expiré, reconnecte-toi."

# Empreinte factice : on vérifie toujours un mot de passe, même si l'e-mail est
# inconnu, pour ne pas révéler par le temps de réponse quels comptes existent.
_DUMMY_HASH = hash_password("orea-dummy-password-1")


class IssuedTokens:
    def __init__(self, user: User) -> None:
        self.user = user
        self.access_token, self.expires_in = create_access_token(user.id, user.role.value)
        self.refresh_token, self.jti, self.refresh_expires_at = create_refresh_token(user.id)


def register(db: Session, data: RegisterIn) -> User:
    if db.scalar(select(User.id).where(User.email == data.email.lower())):
        raise Conflict("Un compte existe déjà avec cet e-mail. Connecte-toi plutôt !",
                       code="EMAIL_TAKEN")
    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        full_name=data.full_name.strip(),
        phone=data.phone,
        role=Role.USER,
    )
    db.add(user)
    db.flush()
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None:
        verify_password(password, _DUMMY_HASH)
        raise Unauthorized(INVALID_CREDENTIALS, code="INVALID_CREDENTIALS")
    if not verify_password(password, user.password_hash):
        raise Unauthorized(INVALID_CREDENTIALS, code="INVALID_CREDENTIALS")
    if not user.is_active:
        raise Unauthorized("Ce compte est désactivé. Contacte l'équipe Orea.",
                           code="ACCOUNT_DISABLED")
    user.last_login_at = utcnow()
    return user


def issue_tokens(db: Session, user: User) -> IssuedTokens:
    tokens = IssuedTokens(user)
    db.add(RefreshToken(user_id=user.id, jti=tokens.jti, expires_at=tokens.refresh_expires_at))
    return tokens


def rotate_refresh(db: Session, refresh_token: str | None) -> IssuedTokens:
    """Échange un refresh token valide contre une nouvelle paire de jetons.

    Rotation : l'ancien jeton est révoqué. Si un jeton déjà révoqué est présenté,
    c'est le signe d'un vol : toutes les sessions de l'utilisateur sont fermées.
    """
    if not refresh_token:
        raise Unauthorized(SESSION_EXPIRED, code="SESSION_EXPIRED")
    try:
        payload = decode_token(refresh_token, "refresh")
    except jwt.PyJWTError as exc:
        raise Unauthorized(SESSION_EXPIRED, code="SESSION_EXPIRED") from exc

    stored = db.scalar(select(RefreshToken).where(RefreshToken.jti == payload["jti"]))
    if stored is None:
        raise Unauthorized(SESSION_EXPIRED, code="SESSION_EXPIRED")
    if stored.revoked_at is not None:
        revoke_all(db, stored.user_id)
        db.commit()
        raise Unauthorized("Session invalide, reconnecte-toi par sécurité.",
                           code="TOKEN_REUSED")

    user = db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise Unauthorized(SESSION_EXPIRED, code="SESSION_EXPIRED")

    stored.revoked_at = utcnow()
    return issue_tokens(db, user)


def revoke(db: Session, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    try:
        payload = decode_token(refresh_token, "refresh")
    except jwt.PyJWTError:
        return
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.jti == payload["jti"], RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )


def revoke_all(db: Session, user_id: uuid.UUID) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
