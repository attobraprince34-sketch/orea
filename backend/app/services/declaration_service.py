"""Déclarations : création, lecture, recherche publique, espace point relais."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.errors import BadRequest, Conflict, Forbidden, NotFound
from app.core.security import hash_doc_number
from app.db.base import utcnow
from app.models import FoundDocument, LostReport, Match, RelayPoint, User
from app.models.enums import (
    DOC_TYPE_LABELS,
    DOC_TYPE_POSSESSIVE,
    OPEN_STATUSES,
    Commune,
    DeclarationStatus,
    DocType,
    NotificationKind,
    Role,
    agree,
    commune_with_preposition,
)
from app.schemas.declarations import (
    FoundCreate,
    FoundOut,
    LostCreate,
    LostOut,
    MatchForOwner,
    PublicSearchItem,
)
from app.schemas.users import RelayPointBrief
from app.services import audit_service, matching_service, notification_service, photo_storage
from app.utils.text import clean_display_name, initials, normalize_name, upper_first


# ------------------------------------------------------------------------------
# Conversion vers les schémas de sortie
# ------------------------------------------------------------------------------
def to_found_out(found: FoundDocument) -> FoundOut:
    out = FoundOut.model_validate(found)
    out.has_photo = bool(found.blurred_photo_path)
    return out


def to_lost_out(lost: LostReport) -> LostOut:
    matches = [
        MatchForOwner(
            match_id=m.id,
            found_document_id=m.found_document.id,
            score=m.score,
            found_on=m.found_document.found_on,
            status=m.found_document.status,
            received_by_relay=m.found_document.received_at is not None,
            relay_point=RelayPointBrief.model_validate(m.found_document.relay_point),
            reasons=matching_service.explain(m.found_document, lost),
        )
        for m in sorted(lost.matches, key=lambda m: m.score, reverse=True)
        if m.found_document.status != DeclarationStatus.CANCELLED
    ]
    return LostOut(
        id=lost.id,
        doc_type=lost.doc_type,
        holder_name=lost.holder_name,
        birth_date=lost.birth_date,
        commune_lost=lost.commune_lost,
        lost_on=lost.lost_on,
        has_number=lost.number_hash is not None,
        status=lost.status,
        matches=matches,
        created_at=lost.created_at,
    )


# ------------------------------------------------------------------------------
# Création
# ------------------------------------------------------------------------------
def _active_relay_point(db: Session, relay_point_id: uuid.UUID) -> RelayPoint:
    relay = db.get(RelayPoint, relay_point_id)
    if relay is None or not relay.is_active:
        raise BadRequest("Ce point relais n'est pas disponible. Choisis-en un autre sur la carte.",
                         code="RELAY_UNAVAILABLE")
    return relay


def create_found(
    db: Session, finder: User, data: FoundCreate
) -> tuple[FoundDocument, list[Match]]:
    """Enregistre une pièce trouvée puis lance la correspondance."""
    _active_relay_point(db, data.relay_point_id)
    number_hash = hash_doc_number(data.document_number)

    # Une même pièce ne peut pas être déclarée deux fois tant qu'elle est en circulation.
    duplicate = db.scalar(
        select(FoundDocument.id).where(
            FoundDocument.number_hash == number_hash,
            FoundDocument.doc_type == data.doc_type,
            FoundDocument.status.in_(
                (*OPEN_STATUSES, DeclarationStatus.CLAIMED)
            ),
        )
    )
    if duplicate:
        raise Conflict("Cette pièce a déjà été signalée. Merci quand même pour ton geste !",
                       code="ALREADY_DECLARED")

    holder = clean_display_name(data.holder_name)
    found = FoundDocument(
        finder_id=finder.id,
        relay_point_id=data.relay_point_id,
        doc_type=data.doc_type,
        holder_name=holder,
        holder_name_norm=normalize_name(holder),
        holder_initials=initials(holder),
        birth_date=data.birth_date,
        number_hash=number_hash,
        commune_found=data.commune_found,
        found_on=data.found_on,
        notes=data.notes,
    )
    db.add(found)
    db.flush()
    if data.upload_id:
        # La photo (déjà floutée par /ocr/scan) quitte la zone d'attente.
        found.blurred_photo_path = photo_storage.attach_to_found(finder.id, data.upload_id,
                                                                 found.id)
        db.flush()  # écrire le chemin AVANT le refresh, sinon il serait perdu
    db.refresh(found)

    matches = matching_service.find_matches_for_found(db, found)
    audit_service.log(db, "found.created", actor_id=finder.id, target=found.id,
                      matches=len(matches))
    return found, matches


def create_lost(db: Session, owner: User, data: LostCreate) -> tuple[LostReport, list[Match]]:
    """Enregistre une perte puis lance la correspondance."""
    holder = clean_display_name(data.holder_name)
    lost = LostReport(
        owner_id=owner.id,
        doc_type=data.doc_type,
        holder_name=holder,
        holder_name_norm=normalize_name(holder),
        holder_initials=initials(holder),
        birth_date=data.birth_date,
        number_hash=hash_doc_number(data.document_number) if data.document_number else None,
        commune_lost=data.commune_lost,
        lost_on=data.lost_on,
    )
    db.add(lost)
    db.flush()
    db.refresh(lost)

    matches = matching_service.find_matches_for_lost(db, lost)
    audit_service.log(db, "lost.created", actor_id=owner.id, target=lost.id,
                      matches=len(matches))
    return lost, matches


# ------------------------------------------------------------------------------
# Lecture
# ------------------------------------------------------------------------------
def list_found_by_finder(db: Session, finder_id: uuid.UUID) -> list[FoundDocument]:
    return list(
        db.scalars(
            select(FoundDocument)
            .options(selectinload(FoundDocument.relay_point))
            .where(FoundDocument.finder_id == finder_id)
            .order_by(FoundDocument.created_at.desc())
        )
    )


def list_lost_by_owner(db: Session, owner_id: uuid.UUID) -> list[LostReport]:
    return list(
        db.scalars(
            select(LostReport)
            .options(
                selectinload(LostReport.matches)
                .selectinload(Match.found_document)
                .selectinload(FoundDocument.relay_point)
            )
            .where(LostReport.owner_id == owner_id)
            .order_by(LostReport.created_at.desc())
        )
    )


def get_found_for(db: Session, found_id: uuid.UUID, user: User) -> FoundDocument:
    """Détail d'une pièce trouvée, réservé à son auteur, au point relais et à l'admin."""
    found = db.get(FoundDocument, found_id)
    if found is None:
        raise NotFound("Cette pièce est introuvable.")
    allowed = (
        user.role == Role.ADMIN
        or found.finder_id == user.id
        or (user.role == Role.RELAY and user.relay_point_id == found.relay_point_id)
    )
    if not allowed:
        raise Forbidden()
    return found


def cancel_lost(db: Session, owner: User, lost_id: uuid.UUID) -> LostReport:
    lost = db.get(LostReport, lost_id)
    if lost is None or lost.owner_id != owner.id:
        raise NotFound("Cette déclaration est introuvable.")
    if lost.status not in OPEN_STATUSES:
        raise Conflict("Cette déclaration ne peut plus être clôturée.")
    lost.status = DeclarationStatus.CANCELLED
    audit_service.log(db, "lost.cancelled", actor_id=owner.id, target=lost.id)
    return lost


# ------------------------------------------------------------------------------
# Recherche publique
# ------------------------------------------------------------------------------
def public_search(
    db: Session,
    *,
    doc_type: DocType | None,
    name: str | None,
    commune: Commune | None,
    limit: int = 20,
) -> list[PublicSearchItem]:
    """Recherche ouverte à tous.

    Ne renvoie QUE le type de pièce, les initiales et la commune du point relais :
    impossible de reconstituer l'identité de quelqu'un à partir des résultats.
    """
    query = (
        select(FoundDocument, RelayPoint.commune)
        .join(RelayPoint, FoundDocument.relay_point_id == RelayPoint.id)
        .where(FoundDocument.status.in_(OPEN_STATUSES))
        .order_by(FoundDocument.created_at.desc())
    )
    if doc_type:
        query = query.where(FoundDocument.doc_type == doc_type)
    if commune:
        query = query.where(RelayPoint.commune == commune)

    normalized = normalize_name(name) if name else ""
    if not normalized:
        rows = db.execute(query.limit(limit)).all()
        return [_search_item(found, relay_commune, None) for found, relay_commune in rows]

    # Avec un nom : comparaison floue en mémoire sur les candidats ouverts.
    scored = []
    for found, relay_commune in db.execute(query.limit(2000)).all():
        score = matching_service.name_score(normalized, found.holder_name_norm)
        if score >= settings.SEARCH_THRESHOLD:
            scored.append((score, found, relay_commune))
    scored.sort(key=lambda row: row[0], reverse=True)
    return [_search_item(found, c, round(score, 1)) for score, found, c in scored[:limit]]


def _search_item(
    found: FoundDocument, relay_commune: Commune, score: float | None
) -> PublicSearchItem:
    return PublicSearchItem(
        id=found.id,
        doc_type=found.doc_type,
        doc_type_label=DOC_TYPE_LABELS[found.doc_type],
        holder_initials=found.holder_initials,
        commune=relay_commune,
        found_on=found.found_on,
        score=score,
    )


# ------------------------------------------------------------------------------
# Espace point relais
# ------------------------------------------------------------------------------
def _require_relay(user: User) -> uuid.UUID:
    if user.relay_point_id is None:
        raise Forbidden("Ton compte n'est rattaché à aucun point relais.", code="NO_RELAY_POINT")
    return user.relay_point_id


def list_for_relay(
    db: Session, agent: User, status: DeclarationStatus | None = None, awaiting: bool = False
) -> list[FoundDocument]:
    relay_id = _require_relay(agent)
    query = (
        select(FoundDocument)
        .options(selectinload(FoundDocument.relay_point))
        .where(FoundDocument.relay_point_id == relay_id)
        .order_by(FoundDocument.created_at.desc())
    )
    if status:
        query = query.where(FoundDocument.status == status)
    if awaiting:
        query = query.where(FoundDocument.received_at.is_(None))
    return list(db.scalars(query))


def confirm_reception(db: Session, agent: User, found_id: uuid.UUID) -> FoundDocument:
    """L'agent confirme que la pièce est physiquement arrivée au point relais."""
    relay_id = _require_relay(agent)
    found = db.get(FoundDocument, found_id)
    if found is None or found.relay_point_id != relay_id:
        raise NotFound("Cette pièce n'est pas attendue dans ton point relais.")
    if found.received_at is not None:
        raise Conflict("La réception de cette pièce est déjà confirmée.", code="ALREADY_RECEIVED")
    if found.status in (DeclarationStatus.CANCELLED, DeclarationStatus.EXPIRED,
                        DeclarationStatus.RETURNED):
        raise Conflict("Cette déclaration n'est plus active.")

    found.received_at = utcnow()
    relay = found.relay_point
    notification_service.notify(
        db,
        found.finder,
        NotificationKind.RECEIVED,
        title="Dépôt confirmé, merci !",
        body=f"« {relay.name} » a bien reçu la pièce que tu as trouvée. Mission accomplie.",
        link="/tableau-de-bord",
    )
    # Les propriétaires déjà prévenus apprennent que la pièce est disponible.
    for match in found.matches:
        if match.lost_report.status in (*OPEN_STATUSES, DeclarationStatus.CLAIMED):
            doc = found.doc_type
            notification_service.notify(
                db,
                match.lost_report.owner,
                NotificationKind.RECEIVED,
                title=(
                    f"{upper_first(DOC_TYPE_POSSESSIVE[doc])} est "
                    f"{agree(doc, 'arrivée', 'arrivé')} {commune_with_preposition(relay.commune)} !"
                ),
                body=(
                    f"{agree(doc, 'Elle', 'Il')} t'attend chez « {relay.name} », {relay.address}."
                ),
                link=f"/reclamer/{found.id}",
            )
    audit_service.log(db, "found.received", actor_id=agent.id, target=found.id)
    return found


def count_open_by_relay(db: Session, relay_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(FoundDocument)
            .where(FoundDocument.relay_point_id == relay_id,
                   FoundDocument.status.in_(OPEN_STATUSES))
        )
        or 0
    )

