"""Statistiques : compteurs publics et tableau de bord administrateur.

Les agrégats sont calculés avec des requêtes SQL portables (PostgreSQL et SQLite).
"""

import time
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import FoundDocument, LostReport, Match, RelayPoint, User
from app.models.enums import (
    DOC_TYPE_LABELS,
    STATUS_LABELS,
    Commune,
    DeclarationStatus,
    DocType,
    commune_label,
)
from app.schemas.stats import ActivityItem, AdminStats, CountByLabel, DailyPoint, PublicStats

_PUBLIC_CACHE: tuple[float, PublicStats] | None = None
PUBLIC_CACHE_SECONDS = 60


def _count(db: Session, model: type, *conditions: object) -> int:
    return int(db.scalar(select(func.count()).select_from(model).where(*conditions)) or 0)


def _rate(returned: int, found: int) -> float:
    return round(100 * returned / found, 1) if found else 0.0


def public_stats(db: Session, use_cache: bool = True) -> PublicStats:
    """Compteurs de la landing page, mis en cache 60 s (la page est très consultée)."""
    global _PUBLIC_CACHE
    if use_cache and _PUBLIC_CACHE and time.monotonic() - _PUBLIC_CACHE[0] < PUBLIC_CACHE_SECONDS:
        return _PUBLIC_CACHE[1]

    found = _count(db, FoundDocument, FoundDocument.status != DeclarationStatus.CANCELLED)
    returned = _count(db, FoundDocument, FoundDocument.status == DeclarationStatus.RETURNED)
    relays = _count(db, RelayPoint, RelayPoint.is_active.is_(True))
    communes = int(
        db.scalar(
            select(func.count(func.distinct(RelayPoint.commune))).where(
                RelayPoint.is_active.is_(True)
            )
        )
        or 0
    )
    stats = PublicStats(
        documents_found=found,
        documents_returned=returned,
        success_rate=_rate(returned, found),
        relay_points=relays,
        communes_covered=communes,
    )
    _PUBLIC_CACHE = (time.monotonic(), stats)
    return stats


def clear_cache() -> None:
    global _PUBLIC_CACHE
    _PUBLIC_CACHE = None


def admin_stats(db: Session, days: int = 30) -> AdminStats:
    active = FoundDocument.status != DeclarationStatus.CANCELLED
    found = _count(db, FoundDocument, active)
    returned = _count(db, FoundDocument, FoundDocument.status == DeclarationStatus.RETURNED)

    by_commune_rows = db.execute(
        select(FoundDocument.commune_found, func.count())
        .where(active)
        .group_by(FoundDocument.commune_found)
        .order_by(func.count().desc())
    ).all()
    by_type_rows = db.execute(
        select(FoundDocument.doc_type, func.count()).where(active).group_by(FoundDocument.doc_type)
    ).all()
    by_status_rows = db.execute(
        select(FoundDocument.status, func.count()).group_by(FoundDocument.status)
    ).all()

    # Délai moyen entre la déclaration et la restitution (calculé en Python pour
    # rester portable entre PostgreSQL et SQLite).
    durations = [
        (returned_at - created_at).total_seconds() / 86400
        for created_at, returned_at in db.execute(
            select(FoundDocument.created_at, FoundDocument.returned_at).where(
                FoundDocument.returned_at.is_not(None)
            )
        ).all()
    ]

    return AdminStats(
        users=_count(db, User),
        documents_found=found,
        lost_reports=_count(db, LostReport, LostReport.status != DeclarationStatus.CANCELLED),
        matches=_count(db, Match),
        documents_returned=returned,
        pending_at_relays=_count(
            db,
            FoundDocument,
            FoundDocument.received_at.is_not(None),
            FoundDocument.status.in_(
                (DeclarationStatus.PENDING, DeclarationStatus.MATCHED, DeclarationStatus.CLAIMED)
            ),
        ),
        success_rate=_rate(returned, found),
        average_days_to_return=round(sum(durations) / len(durations), 1) if durations else None,
        by_commune=[
            CountByLabel(key=Commune(c).value, label=commune_label(c), count=n)
            for c, n in by_commune_rows
        ],
        by_doc_type=[
            CountByLabel(key=DocType(t).value, label=DOC_TYPE_LABELS[DocType(t)], count=n)
            for t, n in sorted(by_type_rows, key=lambda r: r[1], reverse=True)
        ],
        by_status=[
            CountByLabel(key=DeclarationStatus(s).value, label=STATUS_LABELS[DeclarationStatus(s)],
                         count=n)
            for s, n in by_status_rows
        ],
        timeline=_timeline(db, days),
    )


def _timeline(db: Session, days: int) -> list[DailyPoint]:
    """Série quotidienne : pièces trouvées, pertes déclarées, restitutions."""
    today = datetime.now(UTC).date()
    start = today - timedelta(days=days - 1)
    since = datetime.combine(start, datetime.min.time(), tzinfo=UTC)
    buckets: dict[date, dict[str, int]] = {
        start + timedelta(days=i): {"found": 0, "lost": 0, "returned": 0} for i in range(days)
    }

    def _fill(column: object, key: str, model: type) -> None:
        for (moment,) in db.execute(select(column).where(column >= since)).all():
            if moment is None:
                continue
            day = moment.astimezone(UTC).date()
            if day in buckets:
                buckets[day][key] += 1

    _fill(FoundDocument.created_at, "found", FoundDocument)
    _fill(LostReport.created_at, "lost", LostReport)
    _fill(FoundDocument.returned_at, "returned", FoundDocument)
    return [DailyPoint(day=day, **values) for day, values in sorted(buckets.items())]


def recent_activity(db: Session, limit: int = 12) -> list[ActivityItem]:
    """Derniers signalements, correspondances et restitutions (sans aucun nom)."""
    from app.models import RelayPoint

    events: list[ActivityItem] = []

    def item(kind: str, doc_type: DocType, commune: Commune, at: datetime) -> ActivityItem:
        return ActivityItem(kind=kind, doc_type=doc_type.value,
                            doc_type_label=DOC_TYPE_LABELS[doc_type],
                            commune=commune.value, commune_label=commune_label(commune), at=at)

    active = FoundDocument.status != DeclarationStatus.CANCELLED
    for doc_type, commune, at in db.execute(
        select(FoundDocument.doc_type, RelayPoint.commune, FoundDocument.created_at)
        .join(RelayPoint, RelayPoint.id == FoundDocument.relay_point_id)
        .where(active).order_by(FoundDocument.created_at.desc()).limit(limit)
    ):
        events.append(item("found", doc_type, commune, at))
    for doc_type, commune, at in db.execute(
        select(FoundDocument.doc_type, RelayPoint.commune, Match.created_at)
        .join(FoundDocument, FoundDocument.id == Match.found_document_id)
        .join(RelayPoint, RelayPoint.id == FoundDocument.relay_point_id)
        .order_by(Match.created_at.desc()).limit(limit)
    ):
        events.append(item("match", doc_type, commune, at))
    for doc_type, commune, at in db.execute(
        select(FoundDocument.doc_type, RelayPoint.commune, FoundDocument.returned_at)
        .join(RelayPoint, RelayPoint.id == FoundDocument.relay_point_id)
        .where(FoundDocument.returned_at.is_not(None))
        .order_by(FoundDocument.returned_at.desc()).limit(limit)
    ):
        events.append(item("returned", doc_type, commune, at))
    events.sort(key=lambda e: e.at, reverse=True)
    return events[:limit]
