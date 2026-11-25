"""Notifications in-app de l'utilisateur connecté."""

import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.claims import NotificationList, NotificationOut
from app.schemas.common import Message
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationList, summary="Mes notifications")
def list_notifications(user: CurrentUser, db: DbSession) -> NotificationList:
    items, unread = notification_service.list_for_user(db, user.id)
    return NotificationList(items=[NotificationOut.model_validate(n) for n in items],
                            unread=unread)


@router.post("/{notification_id}/read", response_model=Message, summary="Marquer comme lue")
def read_one(notification_id: uuid.UUID, user: CurrentUser, db: DbSession) -> Message:
    notification_service.mark_read(db, user.id, notification_id)
    return Message(message="Notification lue.")


@router.post("/read-all", response_model=Message, summary="Tout marquer comme lu")
def read_all(user: CurrentUser, db: DbSession) -> Message:
    notification_service.mark_read(db, user.id)
    return Message(message="Toutes les notifications sont lues.")
