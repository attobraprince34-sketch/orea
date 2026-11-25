"""Notifications in-app (et e-mail, branché en phase 3).

Les services métier appellent `notify()` au fil de l'eau : la notification est
ajoutée à la session, et l'e-mail correspondant est mis en file d'attente dans
`session.info`. Une fois la transaction validée, la route appelle
`dispatch_emails()` qui confie les envois aux BackgroundTasks de FastAPI :
aucun e-mail n'est donc envoyé pour une opération qui aurait échoué.
"""

import logging
import uuid
from dataclasses import dataclass

from fastapi import BackgroundTasks
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import Notification, User
from app.models.enums import NotificationKind, Role

logger = logging.getLogger("orea.notifications")

_PENDING_KEY = "orea_pending_emails"


@dataclass(frozen=True)
class PendingEmail:
    to: str
    name: str
    subject: str
    body: str
    link: str | None


def notify(
    db: Session,
    user: User,
    kind: NotificationKind,
    *,
    title: str,
    body: str,
    link: str | None = None,
    email: bool = True,
) -> Notification:
    notification = Notification(user_id=user.id, kind=kind, title=title, body=body, link=link)
    db.add(notification)
    if email and user.is_active:
        db.info.setdefault(_PENDING_KEY, []).append(
            PendingEmail(to=user.email, name=user.full_name, subject=title, body=body, link=link)
        )
    return notification


def notify_admins(db: Session, *, title: str, body: str, link: str | None = None) -> None:
    admins = db.scalars(select(User).where(User.role == Role.ADMIN, User.is_active.is_(True)))
    for admin in admins:
        notify(db, admin, NotificationKind.SYSTEM, title=title, body=body, link=link, email=False)


def dispatch_emails(db: Session, background: BackgroundTasks | None) -> int:
    """À appeler APRÈS db.commit(). Renvoie le nombre d'e-mails programmés."""
    pending: list[PendingEmail] = db.info.pop(_PENDING_KEY, [])
    if not pending:
        return 0
    from app.services import email_service  # import local : évite un cycle

    for message in pending:
        if background is not None:
            background.add_task(email_service.send_notification_email, message)
        else:
            email_service.send_notification_email(message)
    return len(pending)


def discard_emails(db: Session) -> None:
    """À appeler après un rollback."""
    db.info.pop(_PENDING_KEY, None)


# ------------------------------------------------------------------------------
# Lecture
# ------------------------------------------------------------------------------
def list_for_user(
    db: Session, user_id: uuid.UUID, limit: int = 50
) -> tuple[list[Notification], int]:
    items = list(
        db.scalars(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
    )
    unread = db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.read.is_(False))
    )
    return items, int(unread or 0)


def mark_read(db: Session, user_id: uuid.UUID, notification_id: uuid.UUID | None = None) -> None:
    query = update(Notification).where(Notification.user_id == user_id)
    if notification_id is not None:
        query = query.where(Notification.id == notification_id)
    db.execute(query.values(read=True))
    db.commit()
