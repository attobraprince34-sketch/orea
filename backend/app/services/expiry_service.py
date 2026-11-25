"""Expiration automatique (tâche planifiée légère, exécutée toutes les heures).

- Les QR codes non utilisés expirent après PICKUP_CODE_DAYS jours : la réclamation
  passe en « expirée » et la pièce redevient réclamable.
- Les déclarations restées sans suite plus de DECLARATION_EXPIRY_DAYS jours
  passent en « expirée ».
- Les photos floutées jamais rattachées à une déclaration sont supprimées.
"""

import asyncio
import logging
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import utcnow
from app.models import Claim, FoundDocument, LostReport, PickupCode
from app.models.enums import OPEN_STATUSES, ClaimStatus, DeclarationStatus
from app.services import photo_storage

logger = logging.getLogger("orea.expiry")


def expire_pickup_codes(db: Session) -> int:
    now = utcnow()
    claims = db.scalars(
        select(Claim)
        .join(PickupCode, PickupCode.claim_id == Claim.id)
        .where(
            Claim.status == ClaimStatus.ACTIVE,
            PickupCode.used_at.is_(None),
            PickupCode.expires_at <= now,
        )
    ).all()
    for claim in claims:
        claim.status = ClaimStatus.EXPIRED
        found = claim.found_document
        if found.status == DeclarationStatus.CLAIMED:
            found.status = (
                DeclarationStatus.MATCHED if found.matches else DeclarationStatus.PENDING
            )
        if claim.lost_report and claim.lost_report.status == DeclarationStatus.CLAIMED:
            claim.lost_report.status = DeclarationStatus.MATCHED
    return len(claims)


def expire_stale_declarations(db: Session) -> int:
    limit = utcnow() - timedelta(days=settings.DECLARATION_EXPIRY_DAYS)
    total = 0
    for model in (FoundDocument, LostReport):
        result = db.execute(
            update(model)
            .where(model.status.in_(OPEN_STATUSES), model.created_at < limit)
            .values(status=DeclarationStatus.EXPIRED)
        )
        total += result.rowcount or 0
    return total


def run_once(db: Session) -> dict[str, int]:
    codes = expire_pickup_codes(db)
    declarations = expire_stale_declarations(db)
    db.commit()
    photos = photo_storage.purge_pending()
    if codes or declarations or photos:
        logger.info("Expiration : %s QR code(s), %s déclaration(s), %s photo(s) orpheline(s)",
                    codes, declarations, photos)
    return {"pickup_codes": codes, "declarations": declarations, "pending_photos": photos}


async def scheduler_loop() -> None:
    """Boucle lancée au démarrage de l'API (voir main.py)."""
    from app.db.session import SessionLocal

    def _tick() -> None:
        with SessionLocal() as db:
            run_once(db)

    while True:
        try:
            await asyncio.to_thread(_tick)
        except Exception:  # la boucle ne doit jamais s'arrêter
            logger.exception("Échec de la tâche d'expiration")
        await asyncio.sleep(settings.SCHEDULER_INTERVAL_SECONDS)
