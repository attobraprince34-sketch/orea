"""Espace point relais : pièces déposées, réception, restitution par QR code."""

import uuid

from fastapi import APIRouter, BackgroundTasks, Request

from app.api.deps import DbSession, RelayAgent
from app.core.rate_limit import limiter
from app.models.enums import DeclarationStatus
from app.schemas.claims import PickupCodeIn, PickupDone, PickupPreview
from app.schemas.declarations import FoundOut
from app.services import claim_service, declaration_service, notification_service, stats_service

router = APIRouter(prefix="/relay", tags=["Point relais"])


@router.get("/documents", response_model=list[FoundOut], summary="Pièces de mon point relais")
def relay_documents(
    agent: RelayAgent,
    db: DbSession,
    status: DeclarationStatus | None = None,
    awaiting_reception: bool = False,
) -> list[FoundOut]:
    documents = declaration_service.list_for_relay(db, agent, status, awaiting_reception)
    return [declaration_service.to_found_out(d) for d in documents]


@router.post("/documents/{found_id}/receive", response_model=FoundOut,
             summary="Confirmer la réception physique d'une pièce")
def receive_document(
    found_id: uuid.UUID, agent: RelayAgent, db: DbSession, background: BackgroundTasks
) -> FoundOut:
    found = declaration_service.confirm_reception(db, agent, found_id)
    db.commit()
    notification_service.dispatch_emails(db, background)
    return declaration_service.to_found_out(found)


@router.post(
    "/pickup/verify",
    response_model=PickupPreview,
    summary="Scanner un QR code (aperçu, sans le consommer)",
)
@limiter.limit("20/minute")
def verify_pickup(
    request: Request, data: PickupCodeIn, agent: RelayAgent, db: DbSession
) -> PickupPreview:
    preview = claim_service.preview_pickup(db, agent, data.code)
    db.commit()  # enregistre la trace d'audit du scan
    return preview


@router.post("/pickup/confirm", response_model=PickupDone,
             summary="Valider la restitution (consomme le QR code)")
@limiter.limit("20/minute")
def confirm_pickup(
    request: Request, data: PickupCodeIn, agent: RelayAgent, db: DbSession,
    background: BackgroundTasks,
) -> PickupDone:
    found = claim_service.confirm_pickup(db, agent, data.code)
    db.commit()
    notification_service.dispatch_emails(db, background)
    stats_service.clear_cache()
    return PickupDone(
        message="Restitution validée ! La pièce est de retour chez son propriétaire.",
        found_document_id=found.id,
        returned_at=found.returned_at or found.updated_at,
    )

