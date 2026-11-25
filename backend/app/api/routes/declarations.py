"""Déclarations de pièces trouvées et de pertes."""

import uuid

from fastapi import APIRouter, BackgroundTasks, status
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, DbSession
from app.core.errors import NotFound
from app.schemas.declarations import (
    FoundCreate,
    FoundCreated,
    FoundOut,
    LostCreate,
    LostCreated,
    LostOut,
)
from app.services import (
    declaration_service,
    notification_service,
    photo_storage,
    stats_service,
)

found_router = APIRouter(prefix="/found", tags=["Pièces trouvées"])
lost_router = APIRouter(prefix="/lost", tags=["Pertes"])


# ------------------------------------------------------------------------------
# Pièces trouvées
# ------------------------------------------------------------------------------
@found_router.post("", response_model=FoundCreated, status_code=status.HTTP_201_CREATED,
                   summary="Déclarer une pièce trouvée")
def declare_found(
    data: FoundCreate, user: CurrentUser, db: DbSession, background: BackgroundTasks
) -> FoundCreated:
    found, matches = declaration_service.create_found(db, user, data)
    db.commit()
    notification_service.dispatch_emails(db, background)
    stats_service.clear_cache()
    return FoundCreated(declaration=declaration_service.to_found_out(found),
                        matches_found=len(matches))


@found_router.get("/mine", response_model=list[FoundOut], summary="Mes pièces trouvées")
def my_found(user: CurrentUser, db: DbSession) -> list[FoundOut]:
    return [declaration_service.to_found_out(f)
            for f in declaration_service.list_found_by_finder(db, user.id)]


@found_router.get(
    "/{found_id}/photo",
    summary="Photo FLOUTÉE d'une pièce (trouveur, point relais et admin uniquement)",
    response_class=FileResponse,
    responses={200: {"content": {"image/jpeg": {}}}},
)
def found_photo(found_id: uuid.UUID, user: CurrentUser, db: DbSession) -> FileResponse:
    found = declaration_service.get_found_for(db, found_id, user)
    path = photo_storage.absolute(found.blurred_photo_path) if found.blurred_photo_path else None
    if path is None:
        raise NotFound("Aucune photo pour cette pièce.", code="NO_PHOTO")
    return FileResponse(path, media_type="image/jpeg",
                        headers={"Cache-Control": "private, no-store"})


@found_router.get("/{found_id}", response_model=FoundOut, summary="Détail d'une pièce trouvée")
def get_found(found_id: uuid.UUID, user: CurrentUser, db: DbSession) -> FoundOut:
    return declaration_service.to_found_out(declaration_service.get_found_for(db, found_id, user))


# ------------------------------------------------------------------------------
# Pertes
# ------------------------------------------------------------------------------
@lost_router.post("", response_model=LostCreated, status_code=status.HTTP_201_CREATED,
                  summary="Déclarer une perte")
def declare_lost(
    data: LostCreate, user: CurrentUser, db: DbSession, background: BackgroundTasks
) -> LostCreated:
    lost, matches = declaration_service.create_lost(db, user, data)
    db.commit()
    notification_service.dispatch_emails(db, background)
    db.refresh(lost)
    return LostCreated(declaration=declaration_service.to_lost_out(lost),
                       matches_found=len(matches))


@lost_router.get("/mine", response_model=list[LostOut],
                 summary="Mes pertes et leurs correspondances")
def my_lost(user: CurrentUser, db: DbSession) -> list[LostOut]:
    return [declaration_service.to_lost_out(lost)
            for lost in declaration_service.list_lost_by_owner(db, user.id)]


@lost_router.delete("/{lost_id}", response_model=LostOut,
                    summary="Clôturer une déclaration de perte")
def cancel_lost(lost_id: uuid.UUID, user: CurrentUser, db: DbSession) -> LostOut:
    lost = declaration_service.cancel_lost(db, user, lost_id)
    db.commit()
    return declaration_service.to_lost_out(lost)
