"""Schémas transverses."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMModel(BaseModel):
    """Base des schémas de sortie construits à partir des modèles SQLAlchemy."""

    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int


class Message(BaseModel):
    message: str


class Option(BaseModel):
    """Couple valeur / libellé pour les listes déroulantes du frontend."""

    value: str
    label: str


class ErrorOut(BaseModel):
    """Format de toutes les erreurs de l'API (documenté dans Swagger)."""

    code: str
    message: str
    fields: dict[str, str] | None = None
