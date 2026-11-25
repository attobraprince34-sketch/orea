"""Assemblage de toutes les routes sous /api/v1."""

from fastapi import APIRouter

from app.api.routes import (
    admin,
    auth,
    claims,
    declarations,
    notifications,
    ocr,
    public,
    relay,
    users,
)
from app.schemas.common import ErrorOut

# Format d'erreur documenté dans Swagger pour toutes les routes.
_ERRORS = {code: {"model": ErrorOut} for code in (400, 401, 403, 404, 409, 422, 429)}

api_router = APIRouter(responses=_ERRORS)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(public.router)
api_router.include_router(ocr.router)
api_router.include_router(declarations.found_router)
api_router.include_router(declarations.lost_router)
api_router.include_router(claims.router)
api_router.include_router(relay.router)
api_router.include_router(notifications.router)
api_router.include_router(admin.router)
