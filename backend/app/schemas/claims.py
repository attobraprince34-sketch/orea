"""Schémas : réclamations, QR codes et notifications."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ClaimStatus, DocType, NotificationKind
from app.schemas.common import ORMModel
from app.schemas.users import RelayPointBrief


class ClaimCreate(BaseModel):
    found_document_id: uuid.UUID
    document_number: str = Field(min_length=5, max_length=40)


class PickupOut(BaseModel):
    """Contenu du « billet » de retrait affiché par le frontend."""

    qr_payload: str = Field(description="Texte encodé dans le QR code.")
    short_code: str = Field(description="Code de secours à saisir si la caméra échoue.")
    expires_at: datetime
    used_at: datetime | None


class ClaimOut(BaseModel):
    id: uuid.UUID
    status: ClaimStatus
    doc_type: DocType
    doc_type_label: str
    holder_initials: str
    relay_point: RelayPointBrief
    received_by_relay: bool
    pickup: PickupOut | None
    created_at: datetime
    completed_at: datetime | None


class PickupCodeIn(BaseModel):
    code: str = Field(
        min_length=8, max_length=200, description="Contenu du QR scanné ou code de secours."
    )


class PickupPreview(BaseModel):
    """Ce que voit l'agent après un scan, avant de remettre la pièce."""

    claim_id: uuid.UUID
    found_document_id: uuid.UUID
    doc_type: DocType
    doc_type_label: str
    holder_name: str
    claimant_name: str
    claimant_phone: str | None
    expires_at: datetime


class PickupDone(BaseModel):
    message: str
    found_document_id: uuid.UUID
    returned_at: datetime


class NotificationOut(ORMModel):
    id: uuid.UUID
    kind: NotificationKind
    title: str
    body: str
    link: str | None
    read: bool
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread: int
