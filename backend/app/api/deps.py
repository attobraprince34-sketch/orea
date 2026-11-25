"""Dépendances partagées par les routes : session, utilisateur courant, rôles."""

import uuid
from collections.abc import Callable
from typing import Annotated

import jwt
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import Forbidden, Unauthorized
from app.core.security import decode_token
from app.db.session import get_db
from app.models import User
from app.models.enums import Role

# `tokenUrl` active le bouton « Authorize » de Swagger (/docs).
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/token", auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DbSession, token: Annotated[str | None, Depends(oauth2_scheme)]) -> User:
    if not token:
        raise Unauthorized()
    try:
        payload = decode_token(token, "access")
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise Unauthorized("Ta session a expiré, reconnecte-toi.", code="TOKEN_INVALID") from exc

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise Unauthorized("Ce compte n'est plus actif.", code="ACCOUNT_DISABLED")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: Role) -> Callable[[User], User]:
    """Fabrique une dépendance qui n'autorise que certains rôles."""

    def _checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise Forbidden("Cet espace est réservé.", code="ROLE_REQUIRED")
        return user

    return _checker


RelayAgent = Annotated[User, Depends(require_roles(Role.RELAY, Role.ADMIN))]
AdminUser = Annotated[User, Depends(require_roles(Role.ADMIN))]


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None
