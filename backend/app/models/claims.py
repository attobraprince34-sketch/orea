"""Réclamations, QR codes de retrait et tentatives de vérification."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin, TimestampMixin, UTCDateTime, enum_column
from app.models.declarations import FoundDocument, LostReport
from app.models.enums import ClaimStatus
from app.models.user import User


class Claim(IdMixin, TimestampMixin, Base):
    """Réclamation validée : le propriétaire a prouvé connaître le numéro de la pièce."""

    __tablename__ = "claims"

    found_document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("found_documents.id", ondelete="CASCADE"), index=True
    )
    claimant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    lost_report_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("lost_reports.id", ondelete="SET NULL")
    )
    status: Mapped[ClaimStatus] = mapped_column(
        enum_column(ClaimStatus), default=ClaimStatus.ACTIVE, index=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    found_document: Mapped[FoundDocument] = relationship()
    lost_report: Mapped[LostReport | None] = relationship()
    claimant: Mapped[User] = relationship()
    pickup_code: Mapped["PickupCode"] = relationship(
        back_populates="claim", uselist=False, cascade="all, delete-orphan"
    )


class PickupCode(IdMixin, TimestampMixin, Base):
    """QR code de retrait : unique, à usage unique, valable 14 jours.

    Le jeton contenu dans le QR est dérivé par HMAC(QR_SECRET, id + nonce) : on peut
    le régénérer pour réafficher le QR, mais seule son empreinte SHA-256 sert à la
    recherche. Une copie de la base ne suffit donc pas à fabriquer un faux QR.
    """

    __tablename__ = "pickup_codes"

    claim_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("claims.id", ondelete="CASCADE"), unique=True
    )
    nonce: Mapped[str] = mapped_column(String(64))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    short_code_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    validated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )

    claim: Mapped[Claim] = relationship(back_populates="pickup_code")


class ClaimAttempt(IdMixin, TimestampMixin, Base):
    """Chaque essai de numéro est journalisé : c'est ce qui permet de verrouiller une
    réclamation après trop d'échecs (protection contre les essais au hasard)."""

    __tablename__ = "claim_attempts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    found_document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("found_documents.id", ondelete="CASCADE"), index=True
    )
    success: Mapped[bool] = mapped_column(Boolean)
    ip_address: Mapped[str | None] = mapped_column(String(64))
