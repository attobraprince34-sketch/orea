"""Journal d'audit des actions sensibles."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog


def log(
    db: Session,
    action: str,
    *,
    actor_id: uuid.UUID | None = None,
    target: object | None = None,
    **meta: Any,
) -> None:
    """Ajoute une entrée à la session (validée avec la transaction en cours)."""
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            target=str(target) if target is not None else None,
            meta={
                k: v if isinstance(v, int | float | bool) else str(v) for k, v in meta.items()
            },
        )
    )


def recent(db: Session, limit: int = 100, action: str | None = None) -> list[AuditLog]:
    query = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if action:
        query = query.where(AuditLog.action == action)
    return list(db.scalars(query))
