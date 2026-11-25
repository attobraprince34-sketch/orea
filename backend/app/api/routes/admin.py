"""Espace administrateur : statistiques, points relais, utilisateurs, modération."""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, DbSession
from app.core.errors import BadRequest, Conflict, NotFound
from app.models import FoundDocument, LostReport, RelayPoint, User
from app.models.enums import (
    DOC_TYPE_LABELS,
    STATUS_LABELS,
    DeclarationStatus,
    Role,
)
from app.schemas.common import Page
from app.schemas.declarations import DeclarationAdminOut, ModerationIn
from app.schemas.stats import AdminStats, AuditOut
from app.schemas.users import (
    AdminUserUpdate,
    RelayPointIn,
    RelayPointOut,
    RelayPointUpdate,
    UserOut,
)
from app.services import audit_service, stats_service

router = APIRouter(prefix="/admin", tags=["Administration"])


# ------------------------------------------------------------------------------
# Statistiques
# ------------------------------------------------------------------------------
@router.get("/stats", response_model=AdminStats, summary="Indicateurs et graphiques")
def stats(_: AdminUser, db: DbSession,
          days: Annotated[int, Query(ge=7, le=365)] = 30) -> AdminStats:
    return stats_service.admin_stats(db, days)


# ------------------------------------------------------------------------------
# Points relais
# ------------------------------------------------------------------------------
@router.get("/relay-points", response_model=list[RelayPointOut],
            summary="Tous les points relais (actifs et inactifs)")
def list_relay_points(_: AdminUser, db: DbSession) -> list[RelayPoint]:
    return list(db.scalars(select(RelayPoint).order_by(RelayPoint.commune, RelayPoint.name)))


@router.post("/relay-points", response_model=RelayPointOut,
             status_code=status.HTTP_201_CREATED, summary="Ajouter un point relais")
def create_relay_point(data: RelayPointIn, admin: AdminUser, db: DbSession) -> RelayPoint:
    relay = RelayPoint(**data.model_dump())
    db.add(relay)
    db.flush()
    audit_service.log(db, "relay.created", actor_id=admin.id, target=relay.id, name=relay.name)
    db.commit()
    stats_service.clear_cache()
    return relay


@router.patch("/relay-points/{relay_id}", response_model=RelayPointOut,
              summary="Modifier un point relais")
def update_relay_point(relay_id: uuid.UUID, data: RelayPointUpdate, admin: AdminUser,
                       db: DbSession) -> RelayPoint:
    relay = db.get(RelayPoint, relay_id)
    if relay is None:
        raise NotFound("Point relais introuvable.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(relay, field, value)
    audit_service.log(db, "relay.updated", actor_id=admin.id, target=relay.id,
                      fields=",".join(data.model_dump(exclude_unset=True)))
    db.commit()
    stats_service.clear_cache()
    return relay


@router.delete("/relay-points/{relay_id}", response_model=RelayPointOut,
               summary="Désactiver un point relais")
def deactivate_relay_point(relay_id: uuid.UUID, admin: AdminUser, db: DbSession) -> RelayPoint:
    """Un point relais n'est jamais supprimé (il conserve un historique de pièces) :
    il est désactivé et disparaît de la carte."""
    relay = db.get(RelayPoint, relay_id)
    if relay is None:
        raise NotFound("Point relais introuvable.")
    relay.is_active = False
    audit_service.log(db, "relay.deactivated", actor_id=admin.id, target=relay.id)
    db.commit()
    stats_service.clear_cache()
    return relay


# ------------------------------------------------------------------------------
# Utilisateurs
# ------------------------------------------------------------------------------
@router.get("/users", response_model=Page[UserOut], summary="Lister les utilisateurs")
def list_users(
    _: AdminUser,
    db: DbSession,
    q: Annotated[str | None, Query(max_length=120)] = None,
    role: Role | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[UserOut]:
    query = select(User).options(selectinload(User.relay_point))
    if q:
        like = f"%{q.lower()}%"
        query = query.where(or_(func.lower(User.email).like(like),
                                func.lower(User.full_name).like(like)))
    if role:
        query = query.where(User.role == role)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    users = db.scalars(
        query.order_by(User.created_at.desc()).offset((page - 1) * size).limit(size)
    )
    return Page(items=[UserOut.model_validate(u) for u in users], total=total, page=page,
                size=size)


@router.patch("/users/{user_id}", response_model=UserOut,
              summary="Changer le rôle, activer ou désactiver un compte")
def update_user(user_id: uuid.UUID, data: AdminUserUpdate, admin: AdminUser,
                db: DbSession) -> UserOut:
    user = db.get(User, user_id)
    if user is None:
        raise NotFound("Utilisateur introuvable.")
    if user.id == admin.id and (data.role not in (None, Role.ADMIN) or data.is_active is False):
        raise Conflict("Tu ne peux pas retirer tes propres droits d'administrateur.")

    changes = data.model_dump(exclude_unset=True)
    if "relay_point_id" in changes and changes["relay_point_id"] is not None:
        if db.get(RelayPoint, changes["relay_point_id"]) is None:
            raise BadRequest("Point relais introuvable.")
    for field, value in changes.items():
        setattr(user, field, value)
    if user.role == Role.RELAY and user.relay_point_id is None:
        raise BadRequest("Un agent de point relais doit être rattaché à un point relais.",
                         code="RELAY_POINT_REQUIRED")
    audit_service.log(db, "user.updated", actor_id=admin.id, target=user.id,
                      **{k: str(v) for k, v in changes.items()})
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


# ------------------------------------------------------------------------------
# Modération des déclarations
# ------------------------------------------------------------------------------
@router.get("/declarations", response_model=Page[DeclarationAdminOut],
            summary="File de modération")
def list_declarations(
    _: AdminUser,
    db: DbSession,
    kind: Literal["found", "lost"] = "found",
    status_filter: Annotated[DeclarationStatus | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[DeclarationAdminOut]:
    model = FoundDocument if kind == "found" else LostReport
    author_fk = FoundDocument.finder_id if kind == "found" else LostReport.owner_id
    query = select(model, User).join(User, User.id == author_fk)
    if status_filter:
        query = query.where(model.status == status_filter)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.execute(
        query.order_by(model.created_at.desc()).offset((page - 1) * size).limit(size)
    ).all()

    items = []
    for declaration, author in rows:
        commune = (declaration.commune_found if kind == "found" else declaration.commune_lost)
        items.append(
            DeclarationAdminOut(
                id=declaration.id,
                kind=kind,
                doc_type=declaration.doc_type,
                doc_type_label=DOC_TYPE_LABELS[declaration.doc_type],
                holder_name=declaration.holder_name,
                commune=commune,
                status=declaration.status,
                status_label=STATUS_LABELS[declaration.status],
                author_name=author.full_name,
                author_email=author.email,
                created_at=declaration.created_at,
            )
        )
    return Page(items=items, total=total, page=page, size=size)


@router.patch("/declarations/{kind}/{declaration_id}", response_model=DeclarationAdminOut,
              summary="Modérer une déclaration (changer son statut)")
def moderate(
    kind: Literal["found", "lost"],
    declaration_id: uuid.UUID,
    data: ModerationIn,
    admin: AdminUser,
    db: DbSession,
) -> DeclarationAdminOut:
    model = FoundDocument if kind == "found" else LostReport
    declaration = db.get(model, declaration_id)
    if declaration is None:
        raise NotFound("Déclaration introuvable.")
    previous = declaration.status
    declaration.status = data.status
    audit_service.log(db, "declaration.moderated", actor_id=admin.id, target=declaration.id,
                      kind=kind, previous=previous.value, new=data.status.value,
                      reason=data.reason or "")
    db.commit()
    stats_service.clear_cache()
    author = declaration.finder if kind == "found" else declaration.owner
    return DeclarationAdminOut(
        id=declaration.id,
        kind=kind,
        doc_type=declaration.doc_type,
        doc_type_label=DOC_TYPE_LABELS[declaration.doc_type],
        holder_name=declaration.holder_name,
        commune=declaration.commune_found if kind == "found" else declaration.commune_lost,
        status=declaration.status,
        status_label=STATUS_LABELS[declaration.status],
        author_name=author.full_name,
        author_email=author.email,
        created_at=declaration.created_at,
    )


@router.get("/audit", response_model=list[AuditOut], summary="Journal d'audit")
def audit(_: AdminUser, db: DbSession, action: str | None = None,
          limit: Annotated[int, Query(ge=1, le=500)] = 100) -> list[AuditOut]:
    return [AuditOut.model_validate(a) for a in audit_service.recent(db, limit, action)]
