"""Déclarations : pièces trouvées, pertes, et correspondances entre les deux."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, Float, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin, TimestampMixin, UTCDateTime, enum_column, utcnow
from app.models.enums import Commune, DeclarationStatus, DocType
from app.models.user import RelayPoint, User


class FoundDocument(IdMixin, TimestampMixin, Base):
    """Pièce trouvée par un utilisateur et déposée dans un point relais."""

    __tablename__ = "found_documents"

    finder_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    relay_point_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("relay_points.id", ondelete="RESTRICT"), index=True
    )
    doc_type: Mapped[DocType] = mapped_column(enum_column(DocType), index=True)

    # Identité du titulaire. Le nom complet ne sort JAMAIS par les routes publiques.
    holder_name: Mapped[str] = mapped_column(String(160))
    holder_name_norm: Mapped[str] = mapped_column(String(160), index=True)
    holder_initials: Mapped[str] = mapped_column(String(16))
    birth_date: Mapped[date | None] = mapped_column(Date)

    # Empreinte HMAC-SHA256 du numéro : le numéro lui-même n'est jamais stocké.
    number_hash: Mapped[str] = mapped_column(String(64), index=True)

    commune_found: Mapped[Commune] = mapped_column(enum_column(Commune), index=True)
    found_on: Mapped[date] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)

    # Photo floutée (privée) : l'original est supprimé juste après l'OCR (phase 3).
    blurred_photo_path: Mapped[str | None] = mapped_column(String(255))

    status: Mapped[DeclarationStatus] = mapped_column(
        enum_column(DeclarationStatus), default=DeclarationStatus.PENDING, index=True
    )
    received_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    returned_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    finder: Mapped[User] = relationship(foreign_keys=[finder_id])
    relay_point: Mapped[RelayPoint] = relationship()
    matches: Mapped[list["Match"]] = relationship(
        back_populates="found_document", cascade="all, delete-orphan"
    )


class LostReport(IdMixin, TimestampMixin, Base):
    """Déclaration de perte faite par le propriétaire d'une pièce."""

    __tablename__ = "lost_reports"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    doc_type: Mapped[DocType] = mapped_column(enum_column(DocType), index=True)
    holder_name: Mapped[str] = mapped_column(String(160))
    holder_name_norm: Mapped[str] = mapped_column(String(160), index=True)
    holder_initials: Mapped[str] = mapped_column(String(16))
    birth_date: Mapped[date | None] = mapped_column(Date)
    # Facultatif : beaucoup de gens ne connaissent pas leur numéro par cœur.
    number_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    commune_lost: Mapped[Commune | None] = mapped_column(enum_column(Commune))
    lost_on: Mapped[date | None] = mapped_column(Date)

    status: Mapped[DeclarationStatus] = mapped_column(
        enum_column(DeclarationStatus), default=DeclarationStatus.PENDING, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    owner: Mapped[User] = relationship()
    matches: Mapped[list["Match"]] = relationship(
        back_populates="lost_report", cascade="all, delete-orphan"
    )


class Match(IdMixin, TimestampMixin, Base):
    """Correspondance détectée entre une pièce trouvée et une perte déclarée."""

    __tablename__ = "matches"
    __table_args__ = (UniqueConstraint("found_document_id", "lost_report_id", name="pair"),)

    found_document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("found_documents.id", ondelete="CASCADE"), index=True
    )
    lost_report_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("lost_reports.id", ondelete="CASCADE"), index=True
    )
    score: Mapped[float] = mapped_column(Float)

    found_document: Mapped[FoundDocument] = relationship(back_populates="matches")
    lost_report: Mapped[LostReport] = relationship(back_populates="matches")
