"""Réclamations et QR codes de retrait (côté propriétaire)."""

import uuid

from fastapi import APIRouter, BackgroundTasks, Request, Response, status

from app.api.deps import CurrentUser, DbSession, client_ip
from app.core.config import settings
from app.core.errors import NotFound
from app.core.rate_limit import limiter
from app.models.enums import ClaimStatus
from app.schemas.claims import ClaimCreate, ClaimOut
from app.services import claim_service, notification_service, qr_service

router = APIRouter(prefix="/claims", tags=["Réclamations"])


@router.post(
    "",
    response_model=ClaimOut,
    status_code=status.HTTP_201_CREATED,
    summary="Réclamer une pièce en prouvant son numéro",
    description=(
        "Compare l'empreinte du numéro saisi avec celle de la pièce. En cas de succès, "
        "génère un QR code unique, à usage unique, valable 14 jours. Après 5 échecs, la "
        "réclamation est verrouillée 24 h."
    ),
)
@limiter.limit(settings.RATE_LIMIT_VERIFY)
def create_claim(
    request: Request, data: ClaimCreate, user: CurrentUser, db: DbSession,
    background: BackgroundTasks,
) -> ClaimOut:
    claim = claim_service.create_claim(
        db, user, data.found_document_id, data.document_number, client_ip(request)
    )
    db.commit()
    notification_service.dispatch_emails(db, background)
    return claim_service.to_claim_out(claim)


@router.get("/mine", response_model=list[ClaimOut], summary="Mes réclamations et QR codes")
def my_claims(user: CurrentUser, db: DbSession) -> list[ClaimOut]:
    return [claim_service.to_claim_out(c) for c in claim_service.list_for_claimant(db, user.id)]


@router.get(
    "/{claim_id}/qr.png",
    summary="Image du QR code de retrait",
    response_class=Response,
    responses={200: {"content": {"image/png": {}}}},
)
def claim_qr(claim_id: uuid.UUID, user: CurrentUser, db: DbSession) -> Response:
    claim = claim_service.get_for_claimant(db, claim_id, user.id)
    if claim.status != ClaimStatus.ACTIVE or claim.pickup_code is None:
        raise NotFound("Ce QR code n'est plus valide.", code="QR_INACTIVE")
    payload = claim_service.pickup_out(claim.pickup_code).qr_payload
    return Response(
        content=qr_service.make_png(payload),
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )
