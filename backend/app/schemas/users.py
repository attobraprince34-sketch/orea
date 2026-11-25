"""Schémas : authentification, profils, points relais."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, computed_field, field_validator

from app.models.enums import Commune, Role, commune_label
from app.schemas.common import ORMModel

PHONE_PATTERN = r"^\+?[0-9 ]{8,20}$"


def _strong_enough(password: str) -> str:
    if not any(c.isdigit() for c in password) or not any(c.isalpha() for c in password):
        raise ValueError("Ajoute au moins une lettre et un chiffre à ton mot de passe.")
    return password


# ------------------------------------------------------------------------------
# Points relais
# ------------------------------------------------------------------------------
class RelayPointBrief(ORMModel):
    id: uuid.UUID
    name: str
    commune: Commune
    address: str

    @computed_field  # type: ignore[prop-decorator]
    @property
    def commune_label(self) -> str:
        return commune_label(self.commune)


class RelayPointOut(RelayPointBrief):
    latitude: float
    longitude: float
    opening_hours: str
    phone: str | None
    is_active: bool


class RelayPointIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    commune: Commune
    address: str = Field(min_length=4, max_length=255)
    latitude: float = Field(ge=4.9, le=5.7, description="Latitude (zone d'Abidjan)")
    longitude: float = Field(ge=-4.4, le=-3.6, description="Longitude (zone d'Abidjan)")
    opening_hours: str = Field(default="Lun–Ven · 8h–17h", max_length=120)
    phone: str | None = Field(default=None, pattern=PHONE_PATTERN)
    is_active: bool = True


class RelayPointUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    commune: Commune | None = None
    address: str | None = Field(default=None, min_length=4, max_length=255)
    latitude: float | None = Field(default=None, ge=4.9, le=5.7)
    longitude: float | None = Field(default=None, ge=-4.4, le=-3.6)
    opening_hours: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, pattern=PHONE_PATTERN)
    is_active: bool | None = None


# ------------------------------------------------------------------------------
# Utilisateurs
# ------------------------------------------------------------------------------
class UserOut(ORMModel):
    id: uuid.UUID
    email: str  # déjà validé à l'inscription : pas de revalidation en sortie
    full_name: str
    phone: str | None
    role: Role
    is_active: bool
    relay_point: RelayPointBrief | None = None
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, pattern=PHONE_PATTERN)
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=64)

    @field_validator("new_password")
    @classmethod
    def _check_password(cls, value: str | None) -> str | None:
        return _strong_enough(value) if value else value


class AdminUserUpdate(BaseModel):
    role: Role | None = None
    is_active: bool | None = None
    relay_point_id: uuid.UUID | None = None


# ------------------------------------------------------------------------------
# Authentification
# ------------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=64)
    full_name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, pattern=PHONE_PATTERN)

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        return _strong_enough(value)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, value: str) -> str:
        return value.lower()


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
