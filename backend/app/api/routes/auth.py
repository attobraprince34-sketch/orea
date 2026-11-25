"""Authentification : inscription, connexion, rafraîchissement, déconnexion."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.rate_limit import limiter
from app.schemas.common import Message
from app.schemas.users import LoginIn, RegisterIn, TokenOut, UserOut
from app.services import auth_service, email_service
from app.services.auth_service import IssuedTokens

router = APIRouter(prefix="/auth", tags=["Authentification"])

RefreshCookie = Annotated[str | None, Cookie(alias=settings.REFRESH_COOKIE_NAME)]


def _set_refresh_cookie(response: Response, tokens: IssuedTokens) -> None:
    """Le refresh token vit dans un cookie httpOnly : inaccessible au JavaScript,
    donc à l'abri d'une faille XSS."""
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=tokens.refresh_token,
        max_age=settings.REFRESH_TOKEN_DAYS * 86400,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path=f"{settings.API_PREFIX}/auth",
    )


def _token_out(tokens: IssuedTokens) -> TokenOut:
    return TokenOut(
        access_token=tokens.access_token,
        expires_in=tokens.expires_in,
        user=UserOut.model_validate(tokens.user),
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED,
             summary="Créer un compte (connecte automatiquement)")
@limiter.limit(settings.RATE_LIMIT_AUTH)
def register(request: Request, response: Response, data: RegisterIn, db: DbSession,
             background: BackgroundTasks) -> TokenOut:
    user = auth_service.register(db, data)
    tokens = auth_service.issue_tokens(db, user)
    db.commit()
    background.add_task(email_service.send_welcome_email, user)
    _set_refresh_cookie(response, tokens)
    return _token_out(tokens)


@router.post("/login", response_model=TokenOut, summary="Se connecter")
@limiter.limit(settings.RATE_LIMIT_AUTH)
def login(request: Request, response: Response, data: LoginIn, db: DbSession) -> TokenOut:
    user = auth_service.authenticate(db, data.email, data.password)
    tokens = auth_service.issue_tokens(db, user)
    db.commit()
    _set_refresh_cookie(response, tokens)
    return _token_out(tokens)


@router.post("/token", response_model=TokenOut, include_in_schema=True,
             summary="Connexion au format formulaire (bouton « Authorize » de Swagger)")
@limiter.limit(settings.RATE_LIMIT_AUTH)
def token_form(
    request: Request,
    response: Response,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession,
) -> TokenOut:
    user = auth_service.authenticate(db, form.username, form.password)
    tokens = auth_service.issue_tokens(db, user)
    db.commit()
    _set_refresh_cookie(response, tokens)
    return _token_out(tokens)


@router.post("/refresh", response_model=TokenOut, summary="Renouveler le jeton d'accès")
def refresh(response: Response, db: DbSession, refresh_token: RefreshCookie = None) -> TokenOut:
    tokens = auth_service.rotate_refresh(db, refresh_token)
    db.commit()
    _set_refresh_cookie(response, tokens)
    return _token_out(tokens)


@router.post("/logout", response_model=Message, summary="Se déconnecter")
def logout(response: Response, db: DbSession, refresh_token: RefreshCookie = None) -> Message:
    auth_service.revoke(db, refresh_token)
    db.commit()
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, path=f"{settings.API_PREFIX}/auth")
    return Message(message="À bientôt sur Orea !")


@router.post("/logout-all", response_model=Message, summary="Fermer toutes mes sessions")
def logout_all(response: Response, user: CurrentUser, db: DbSession) -> Message:
    auth_service.revoke_all(db, user.id)
    db.commit()
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, path=f"{settings.API_PREFIX}/auth")
    return Message(message="Toutes tes sessions ont été fermées.")
