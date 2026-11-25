"""Routes publiques : référentiels, points relais, statistiques, recherche."""

from typing import Annotated

from fastapi import APIRouter, Query, Request
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.config import settings
from app.core.rate_limit import limiter
from app.models import RelayPoint
from app.models.enums import COMMUNE_LABELS, DOC_TYPE_LABELS, Commune, DocType
from app.schemas.common import Option
from app.schemas.declarations import PublicSearchItem
from app.schemas.stats import ActivityItem, PublicStats
from app.schemas.users import RelayPointOut
from app.services import declaration_service, stats_service

router = APIRouter(tags=["Public"])


@router.get("/meta/doc-types", response_model=list[Option], summary="Types de pièces acceptées")
def doc_types() -> list[Option]:
    return [Option(value=t.value, label=label) for t, label in DOC_TYPE_LABELS.items()]


@router.get("/meta/communes", response_model=list[Option], summary="Communes d'Abidjan")
def communes() -> list[Option]:
    return [Option(value=c.value, label=labels[0]) for c, labels in COMMUNE_LABELS.items()]


@router.get("/relay-points", response_model=list[RelayPointOut],
            summary="Points relais actifs (pour la carte)")
def relay_points(db: DbSession, commune: Commune | None = None) -> list[RelayPoint]:
    query = select(RelayPoint).where(RelayPoint.is_active.is_(True)).order_by(RelayPoint.name)
    if commune:
        query = query.where(RelayPoint.commune == commune)
    return list(db.scalars(query))


@router.get("/stats/public", response_model=PublicStats, summary="Compteurs de la page d'accueil")
def public_stats(db: DbSession) -> PublicStats:
    return stats_service.public_stats(db)


@router.get("/stats/activity", response_model=list[ActivityItem],
            summary="Fil d'activité en direct (anonymisé)")
def activity(db: DbSession, limit: Annotated[int, Query(ge=1, le=30)] = 12) -> list[ActivityItem]:
    return stats_service.recent_activity(db, limit)


@router.get(
    "/search",
    response_model=list[PublicSearchItem],
    summary="Rechercher une pièce trouvée",
    description=(
        "Recherche anonymisée : ne renvoie que le type de pièce, les initiales du titulaire "
        "et la commune du point relais. Limitée à 30 requêtes par minute."
    ),
)
@limiter.limit(settings.RATE_LIMIT_SEARCH)
def search(
    request: Request,
    db: DbSession,
    doc_type: DocType | None = None,
    name: Annotated[str | None, Query(max_length=120, description="Nom et prénoms")] = None,
    commune: Commune | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[PublicSearchItem]:
    return declaration_service.public_search(
        db, doc_type=doc_type, name=name, commune=commune, limit=limit
    )
