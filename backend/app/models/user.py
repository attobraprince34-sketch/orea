"""Utilisateurs, jetons de rafraîchissement et points relais."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Float, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin, TimestampMixin, UTCDateTime, enum_column
from app.models.enums import Commune, Role


class RelayPoint(IdMixin, TimestampMixin, Base):
    """Lieu partenaire (mairie, commissariat, commerce) où les pièces sont déposées."""

    __tablename__ = "relay_points"

    name: Mapped[str] = mapped_column(String(120))
    commune: Mapped[Commune] = mapped_column(enum_column(Commune), index=True)
    address: Mapped[str] = mapped_column(String(255))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    opening_hours: Mapped[str] = mapped_column(String(120), default="Lun–Ven · 8h–17h")
    phone: Mapped[str | None] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    agents: Mapped[list["User"]] = relationship(back_populates="relay_point")


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(32))
    role: Mapped[Role] = mapped_column(enum_column(Role), default=Role.USER, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Renseigné uniquement pour les agents d'un point relais.
    relay_point_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("relay_points.id", ondelete="SET NULL")
    )
    last_login_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    relay_point: Mapped[RelayPoint | None] = relationship(back_populates="agents")


class RefreshToken(IdMixin, TimestampMixin, Base):
    """Jetons de rafraîchissement émis. Permet la révocation et la détection de
    réutilisation (rotation à chaque usage)."""

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    jti: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
