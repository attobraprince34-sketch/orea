"""Réclamation d'une pièce et restitution au point relais.

Parcours :
1. Le propriétaire saisit le numéro de sa pièce. On compare son empreinte à celle
   enregistrée. Après CLAIM_MAX_ATTEMPTS échecs, la réclamation est verrouillée
   CLAIM_LOCK_HOURS heures et l'administrateur est alerté.
2. En cas de succès : création d'une réclamation et d'un QR code unique, à usage
   unique, valable PICKUP_CODE_DAYS jours.
3. Au point relais, l'agent scanne le QR : il voit d'abord un aperçu (verify),
   puis valide la remise (confirm), ce qui consomme le QR.
"""

import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.errors import BadRequest, Conflict, Forbidden, NotFound, TooManyRequests
from app.core.security import verify_doc_number
from app.db.base import utcnow
from app.models import Claim, ClaimAttempt, FoundDocument, LostReport, Match, PickupCode, User
from app.models.enums import (
    DOC_TYPE_LABELS,
    DOC_TYPE_POSSESSIVE,
    OPEN_STATUSES,
    ClaimStatus,
    DeclarationStatus,
    NotificationKind,
)
from app.schemas.claims import ClaimOut, PickupOut, PickupPreview
from app.schemas.users import RelayPointBrief
from app.services import audit_service, notification_service, qr_service


# ------------------------------------------------------------------------------
# Réclamation
# ------------------------------------------------------------------------------
def _failed_attempts(db: Session, user_id: uuid.UUID, found_id: uuid.UUID) -> int:
    since = utcnow() - timedelta(hours=settings.CLAIM_LOCK_HOURS)
    return int(
        db.scalar(
            select(func.count())
            .select_from(ClaimAttempt)
            .where(
                ClaimAttempt.user_id == user_id,
                ClaimAttempt.found_document_id == found_id,
                ClaimAttempt.success.is_(False),
                ClaimAttempt.created_at >= since,
            )
        )
        or 0
    )


def _locked_error() -> TooManyRequests:
    return TooManyRequests(
        f"Trop de tentatives incorrectes. Par sécurité, cette réclamation est bloquée "
        f"pendant {settings.CLAIM_LOCK_HOURS} h. Si c'est bien ta pièce, présente-toi "
        "au point relais avec un justificatif.",
        code="CLAIM_LOCKED",
    )


def create_claim(
    db: Session, claimant: User, found_id: uuid.UUID, document_number: str, ip: str | None
) -> Claim:
    found = db.get(FoundDocument, found_id)
    if found is None or found.status in (DeclarationStatus.CANCELLED, DeclarationStatus.EXPIRED):
        raise NotFound("Cette pièce n'est plus disponible.")
    if found.finder_id == claimant.id:
        raise Forbidden("Tu ne peux pas réclamer une pièce que tu as toi-même trouvée.",
                        code="OWN_DECLARATION")
    if found.status == DeclarationStatus.RETURNED:
        raise Conflict("Cette pièce a déjà été restituée.", code="ALREADY_RETURNED")
    if found.status == DeclarationStatus.CLAIMED:
        existing = _active_claim_for(db, found.id)
        if existing and existing.claimant_id == claimant.id:
            raise Conflict("Tu as déjà réclamé cette pièce : ton QR code t'attend dans ton espace.",
                           code="ALREADY_CLAIMED_BY_YOU")
        raise Conflict("Cette pièce fait déjà l'objet d'une réclamation.", code="ALREADY_CLAIMED")

    failures = _failed_attempts(db, claimant.id, found.id)
    if failures >= settings.CLAIM_MAX_ATTEMPTS:
        raise _locked_error()

    if not verify_doc_number(document_number, found.number_hash):
        db.add(ClaimAttempt(user_id=claimant.id, found_document_id=found.id, success=False,
                            ip_address=ip))
        failures += 1
        remaining = settings.CLAIM_MAX_ATTEMPTS - failures
        audit_service.log(db, "claim.failed", actor_id=claimant.id, target=found.id,
                          attempt=failures, ip=ip or "")
        if remaining <= 0:
            notification_service.notify_admins(
                db,
                title="Réclamation verrouillée",
                body=f"{claimant.full_name} ({claimant.email}) a échoué "
                f"{failures} fois à prouver la propriété d'une pièce.",
                link=f"/admin/declarations?id={found.id}",
            )
            db.commit()
            raise _locked_error()
        db.commit()
        raise BadRequest(
            "Ce numéro ne correspond pas à la pièce. Vérifie-le bien, "
            f"il te reste {remaining} essai{'s' if remaining > 1 else ''}.",
            code="NUMBER_MISMATCH",
            extra={"remaining_attempts": remaining},
        )

    # --- Succès : réclamation + QR code ---------------------------------------
    db.add(ClaimAttempt(user_id=claimant.id, found_document_id=found.id, success=True,
                        ip_address=ip))
    lost = _owner_lost_report(db, claimant.id, found)
    claim = Claim(found_document=found, claimant=claimant, lost_report=lost)
    db.add(claim)
    db.flush()

    code = PickupCode(
        id=uuid.uuid4(),
        claim=claim,
        nonce=qr_service.new_nonce(),
        expires_at=utcnow() + timedelta(days=settings.PICKUP_CODE_DAYS),
        token_hash="",
        short_code_hash="",
    )
    token = qr_service.derive_token(code.id, code.nonce)
    code.token_hash = qr_service.token_hash(token)
    code.short_code_hash = qr_service.short_code_hash(qr_service.short_code_from_token(token))
    db.add(code)

    found.status = DeclarationStatus.CLAIMED
    if lost is not None:
        lost.status = DeclarationStatus.CLAIMED

    relay = found.relay_point
    notification_service.notify(
        db,
        claimant,
        NotificationKind.CLAIM,
        title="C'est confirmé, ton QR code est prêt !",
        body=(
            f"Présente-le chez « {relay.name} » ({relay.address}) pour récupérer "
            f"{DOC_TYPE_POSSESSIVE[found.doc_type]}. Il est valable "
            f"{settings.PICKUP_CODE_DAYS} jours et ne sert qu'une fois."
        ),
        link="/tableau-de-bord?onglet=qr",
    )
    audit_service.log(db, "claim.verified", actor_id=claimant.id, target=found.id,
                      claim=claim.id)
    return claim


def _active_claim_for(db: Session, found_id: uuid.UUID) -> Claim | None:
    return db.scalar(
        select(Claim).where(Claim.found_document_id == found_id,
                            Claim.status == ClaimStatus.ACTIVE)
    )


def _owner_lost_report(db: Session, owner_id: uuid.UUID, found: FoundDocument) -> LostReport | None:
    """Rattache la réclamation à la déclaration de perte du propriétaire, s'il en a une."""
    matched = db.scalar(
        select(LostReport)
        .join(Match, Match.lost_report_id == LostReport.id)
        .where(Match.found_document_id == found.id, LostReport.owner_id == owner_id,
               LostReport.status.in_(OPEN_STATUSES))
    )
    if matched:
        return matched
    return db.scalar(
        select(LostReport).where(
            LostReport.owner_id == owner_id,
            LostReport.doc_type == found.doc_type,
            LostReport.status.in_(OPEN_STATUSES),
        )
    )


# ------------------------------------------------------------------------------
# Lecture côté propriétaire
# ------------------------------------------------------------------------------
def pickup_out(code: PickupCode) -> PickupOut:
    token = qr_service.derive_token(code.id, code.nonce)
    return PickupOut(
        qr_payload=qr_service.payload_from_token(token),
        short_code=qr_service.short_code_from_token(token),
        expires_at=code.expires_at,
        used_at=code.used_at,
    )


def to_claim_out(claim: Claim) -> ClaimOut:
    found = claim.found_document
    return ClaimOut(
        id=claim.id,
        status=claim.status,
        doc_type=found.doc_type,
        doc_type_label=DOC_TYPE_LABELS[found.doc_type],
        holder_initials=found.holder_initials,
        relay_point=RelayPointBrief.model_validate(found.relay_point),
        received_by_relay=found.received_at is not None,
        # Le QR n'est plus affiché une fois expiré ou annulé.
        pickup=pickup_out(claim.pickup_code)
        if claim.pickup_code and claim.status in (ClaimStatus.ACTIVE, ClaimStatus.COMPLETED)
        else None,
        created_at=claim.created_at,
        completed_at=claim.completed_at,
    )


def list_for_claimant(db: Session, user_id: uuid.UUID) -> list[Claim]:
    return list(
        db.scalars(
            select(Claim)
            .options(
                selectinload(Claim.pickup_code),
                selectinload(Claim.found_document).selectinload(FoundDocument.relay_point),
            )
            .where(Claim.claimant_id == user_id)
            .order_by(Claim.created_at.desc())
        )
    )


def get_for_claimant(db: Session, claim_id: uuid.UUID, user_id: uuid.UUID) -> Claim:
    claim = db.get(Claim, claim_id)
    if claim is None or claim.claimant_id != user_id:
        raise NotFound("Réclamation introuvable.")
    return claim


# ------------------------------------------------------------------------------
# Restitution au point relais
# ------------------------------------------------------------------------------
def _resolve_code(db: Session, agent: User, raw_code: str) -> PickupCode:
    """Retrouve et contrôle un QR code. Toutes les vérifications sont faites ici
    pour que `verify` et `confirm` appliquent exactement les mêmes règles."""
    if agent.relay_point_id is None:
        raise Forbidden("Ton compte n'est rattaché à aucun point relais.", code="NO_RELAY_POINT")

    parsed = qr_service.lookup_hashes(raw_code)
    if parsed is None:
        raise BadRequest("Ce QR code n'est pas un code Orea.", code="QR_INVALID")
    kind, digest = parsed
    column = PickupCode.token_hash if kind == "token" else PickupCode.short_code_hash
    code = db.scalar(select(PickupCode).where(column == digest))
    if code is None:
        raise NotFound("QR code inconnu. Vérifie que c'est bien le bon.", code="QR_UNKNOWN")

    claim = code.claim
    found = claim.found_document
    if found.relay_point_id != agent.relay_point_id:
        raise Forbidden(
            f"Cette pièce est conservée chez « {found.relay_point.name} », pas ici.",
            code="QR_WRONG_RELAY",
        )
    if code.used_at is not None or claim.status == ClaimStatus.COMPLETED:
        raise Conflict("Ce QR code a déjà été utilisé : la pièce a été restituée.",
                       code="QR_ALREADY_USED")
    if code.expires_at <= utcnow() or claim.status == ClaimStatus.EXPIRED:
        raise Conflict("Ce QR code a expiré. Le propriétaire doit refaire une réclamation.",
                       code="QR_EXPIRED")
    if claim.status != ClaimStatus.ACTIVE:
        raise Conflict("Cette réclamation n'est plus active.", code="CLAIM_INACTIVE")
    if found.received_at is None:
        raise Conflict(
            "Cette pièce n'a pas encore été réceptionnée ici. Confirme d'abord sa réception.",
            code="NOT_RECEIVED",
        )
    return code


def preview_pickup(db: Session, agent: User, raw_code: str) -> PickupPreview:
    code = _resolve_code(db, agent, raw_code)
    claim, found = code.claim, code.claim.found_document
    audit_service.log(db, "pickup.scanned", actor_id=agent.id, target=claim.id)
    return PickupPreview(
        claim_id=claim.id,
        found_document_id=found.id,
        doc_type=found.doc_type,
        doc_type_label=DOC_TYPE_LABELS[found.doc_type],
        holder_name=found.holder_name,
        claimant_name=claim.claimant.full_name,
        claimant_phone=claim.claimant.phone,
        expires_at=code.expires_at,
    )


def confirm_pickup(db: Session, agent: User, raw_code: str) -> FoundDocument:
    code = _resolve_code(db, agent, raw_code)
    claim, found = code.claim, code.claim.found_document
    now = utcnow()

    code.used_at = now
    code.validated_by_id = agent.id
    claim.status = ClaimStatus.COMPLETED
    claim.completed_at = now
    found.status = DeclarationStatus.RETURNED
    found.returned_at = now
    if claim.lost_report is not None:
        claim.lost_report.status = DeclarationStatus.RETURNED

    possessive = DOC_TYPE_POSSESSIVE[found.doc_type]
    notification_service.notify(
        db,
        claim.claimant,
        NotificationKind.RETURNED,
        title=f"Et voilà, {possessive} est de retour !",
        body="Restitution validée. Merci d'avoir fait confiance à Orea, prends-en soin.",
        link="/tableau-de-bord",
    )
    notification_service.notify(
        db,
        found.finder,
        NotificationKind.RETURNED,
        title="La pièce que tu as trouvée a été rendue à son propriétaire !",
        body="Grâce à toi, quelqu'un a retrouvé ses papiers aujourd'hui. Merci du fond du cœur.",
        link="/tableau-de-bord",
    )
    audit_service.log(db, "pickup.completed", actor_id=agent.id, target=claim.id,
                      found=found.id)
    return found
