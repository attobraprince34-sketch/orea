"""Erreurs métier et gestionnaires d'exceptions.

Toutes les erreurs de l'API ont le même format, pensé pour être affiché tel quel
par le frontend :

    { "code": "CLAIM_LOCKED", "message": "Trop de tentatives…", "fields": {...} }
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("orea")


class AppError(Exception):
    """Erreur métier contrôlée, renvoyée à l'utilisateur avec un message clair."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "BAD_REQUEST"
    message: str = "La requête est invalide."

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        self.message = message or self.message
        self.code = code or self.code
        self.extra = extra or {}
        super().__init__(self.message)


class BadRequest(AppError):
    pass


class Unauthorized(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"
    message = "Connecte-toi pour continuer."


class Forbidden(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"
    message = "Tu n'as pas accès à cette ressource."


class NotFound(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"
    message = "Introuvable. Elle a peut-être déjà été retirée."


class Conflict(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"
    message = "Cette action entre en conflit avec l'état actuel."


class TooManyRequests(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "TOO_MANY_REQUESTS"
    message = "Doucement ! Trop de tentatives, réessaie dans quelques minutes."


# ------------------------------------------------------------------------------
# Traduction des erreurs de validation Pydantic
# ------------------------------------------------------------------------------
def _translate(error: dict[str, Any]) -> str:
    kind = error.get("type", "")
    ctx = error.get("ctx") or {}
    if kind == "missing":
        return "Ce champ est obligatoire."
    if kind == "string_too_short":
        return f"Trop court : {ctx.get('min_length')} caractères minimum."
    if kind == "string_too_long":
        return f"Trop long : {ctx.get('max_length')} caractères maximum."
    if kind == "value_error" and "email" in str(error.get("msg", "")).lower():
        return "Cette adresse e-mail ne semble pas valide."
    if kind == "enum":
        return "Cette valeur ne fait pas partie des choix possibles."
    if kind in {"date_from_datetime_parsing", "date_parsing", "date_type"}:
        return "Date invalide (format attendu : AAAA-MM-JJ)."
    if kind in {"uuid_parsing", "uuid_type"}:
        return "Identifiant invalide."
    if kind in {"int_parsing", "float_parsing"}:
        return "Un nombre est attendu."
    if kind == "string_pattern_mismatch":
        return "Format invalide."
    if kind == "value_error":
        # Messages levés par nos propres validateurs : déjà en français.
        return str(error.get("msg", "")).removeprefix("Value error, ")
    return "Valeur invalide."


def _field_name(loc: tuple[Any, ...]) -> str:
    parts = [str(p) for p in loc if p not in ("body", "query", "path")]
    return ".".join(parts) or "requête"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.code, "message": exc.message, **exc.extra},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields: dict[str, str] = {}
        for error in exc.errors():
            fields.setdefault(_field_name(tuple(error.get("loc", ()))), _translate(error))
        return JSONResponse(
            status_code=422,
            content={
                "code": "VALIDATION_ERROR",
                "message": "Quelques champs sont à corriger.",
                "fields": fields,
            },
        )

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limited(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "code": "RATE_LIMITED",
                "message": "Doucement ! Trop de requêtes, réessaie dans quelques minutes.",
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        messages = {
            401: "Connecte-toi pour continuer.",
            403: "Tu n'as pas accès à cette ressource.",
            404: "Cette page n'existe pas.",
            405: "Méthode non autorisée.",
        }
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": f"HTTP_{exc.status_code}",
                "message": messages.get(exc.status_code, str(exc.detail)),
            },
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Erreur inattendue", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "code": "INTERNAL_ERROR",
                "message": (
                    "Oups, quelque chose s'est mal passé de notre côté. "
                    "Réessaie dans un instant."
                ),
            },
        )
