"""Schémas : statistiques publiques, tableau de bord admin, audit."""

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.common import ORMModel


class PublicStats(BaseModel):
    """Compteurs animés de la landing page."""

    documents_found: int
    documents_returned: int
    success_rate: float  # en pourcentage, 0–100
    relay_points: int
    communes_covered: int


class CountByLabel(BaseModel):
    key: str
    label: str
    count: int


class DailyPoint(BaseModel):
    day: date
    found: int
    lost: int
    returned: int


class AdminStats(BaseModel):
    users: int
    documents_found: int
    lost_reports: int
    matches: int
    documents_returned: int
    pending_at_relays: int
    success_rate: float
    average_days_to_return: float | None
    by_commune: list[CountByLabel]
    by_doc_type: list[CountByLabel]
    by_status: list[CountByLabel]
    timeline: list[DailyPoint]


class AuditOut(ORMModel):
    id: uuid.UUID
    actor_id: uuid.UUID | None
    action: str
    target: str | None
    meta: dict[str, Any]
    created_at: datetime


class ActivityItem(BaseModel):
    """Événement récent, totalement anonyme : type de pièce et commune seulement."""

    kind: str  # "found" | "match" | "returned"
    doc_type: str
    doc_type_label: str
    commune: str
    commune_label: str
    at: datetime
