"""Schémas : pièces trouvées, pertes, recherche publique."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, computed_field, field_validator

from app.core.security import normalize_doc_number
from app.models.enums import (
    DOC_TYPE_LABELS,
    STATUS_LABELS,
    Commune,
    DeclarationStatus,
    DocType,
    commune_label,
)
from app.schemas.common import ORMModel
from app.schemas.users import RelayPointBrief


def _not_in_future(value: date | None) -> date | None:
    if value and value > date.today():
        raise ValueError("La date ne peut pas être dans le futur.")
    return value


def _valid_number(value: str | None) -> str | None:
    if value is None or value.strip() == "":
        return None
    if not 5 <= len(normalize_doc_number(value)) <= 30:
        raise ValueError("Le numéro de la pièce doit contenir entre 5 et 30 lettres ou chiffres.")
    return value


class _Labels(ORMModel):
    """Ajoute les libellés français calculés à partir des valeurs brutes."""

    doc_type: DocType
    status: DeclarationStatus

    @computed_field  # type: ignore[prop-decorator]
    @property
    def doc_type_label(self) -> str:
        return DOC_TYPE_LABELS[self.doc_type]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def status_label(self) -> str:
        return STATUS_LABELS[self.status]


# ------------------------------------------------------------------------------
# Entrées
# ------------------------------------------------------------------------------
class FoundCreate(BaseModel):
    doc_type: DocType
    holder_name: str = Field(min_length=2, max_length=160, examples=["KOUASSI Aya Marie"])
    birth_date: date | None = None
    document_number: str = Field(
        min_length=5, max_length=40, description="Haché à la réception, jamais stocké en clair."
    )
    commune_found: Commune
    found_on: date
    relay_point_id: uuid.UUID
    notes: str | None = Field(default=None, max_length=500)
    upload_id: str | None = Field(
        default=None, description="Identifiant de la photo floutée renvoyé par /ocr/scan."
    )

    _check_dates = field_validator("birth_date", "found_on")(_not_in_future)
    _check_number = field_validator("document_number")(_valid_number)


class LostCreate(BaseModel):
    doc_type: DocType
    holder_name: str = Field(min_length=2, max_length=160)
    birth_date: date | None = None
    document_number: str | None = Field(default=None, max_length=40)
    commune_lost: Commune | None = None
    lost_on: date | None = None

    _check_dates = field_validator("birth_date", "lost_on")(_not_in_future)
    _check_number = field_validator("document_number")(_valid_number)


# ------------------------------------------------------------------------------
# Sorties
# ------------------------------------------------------------------------------
class FoundOut(_Labels):
    """Vue de l'auteur, du point relais ou de l'admin (jamais publique)."""

    id: uuid.UUID
    doc_type: DocType
    holder_name: str
    holder_initials: str
    birth_date: date | None
    commune_found: Commune
    found_on: date
    notes: str | None
    status: DeclarationStatus
    relay_point: RelayPointBrief
    has_photo: bool = False
    received_at: datetime | None
    returned_at: datetime | None
    created_at: datetime


class MatchForOwner(BaseModel):
    """Ce que voit le propriétaire d'une perte quand une correspondance est trouvée."""

    match_id: uuid.UUID
    found_document_id: uuid.UUID
    score: float
    found_on: date
    status: DeclarationStatus
    received_by_relay: bool
    relay_point: RelayPointBrief
    reasons: list[str] = Field(default_factory=list,
                               description="Pourquoi Orea pense que c'est la bonne pièce.")


class LostOut(_Labels):
    id: uuid.UUID
    doc_type: DocType
    holder_name: str
    birth_date: date | None
    commune_lost: Commune | None
    lost_on: date | None
    has_number: bool = False
    status: DeclarationStatus
    matches: list[MatchForOwner] = []
    created_at: datetime


class FoundCreated(BaseModel):
    declaration: FoundOut
    matches_found: int = Field(description="Nombre de pertes correspondantes détectées.")


class LostCreated(BaseModel):
    declaration: LostOut
    matches_found: int


class PublicSearchItem(BaseModel):
    """Résultat public : type de pièce, initiales et commune. Rien d'autre."""

    id: uuid.UUID
    doc_type: DocType
    doc_type_label: str
    holder_initials: str
    commune: Commune
    found_on: date
    score: float | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def commune_label(self) -> str:
        return commune_label(self.commune)


class DeclarationAdminOut(BaseModel):
    """Ligne de la file de modération (les deux types de déclarations confondus)."""

    id: uuid.UUID
    kind: str  # "found" | "lost"
    doc_type: DocType
    doc_type_label: str
    holder_name: str
    commune: Commune | None
    status: DeclarationStatus
    status_label: str
    author_name: str
    author_email: str
    created_at: datetime


class ModerationIn(BaseModel):
    status: DeclarationStatus
    reason: str | None = Field(default=None, max_length=255)
