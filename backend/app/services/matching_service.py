"""Moteur de correspondance entre pièces trouvées et pertes déclarées.

Principe :
1. Les noms sont normalisés (minuscules, sans accents, sans ponctuation).
2. On ne compare que des pièces du même type, encore « ouvertes ».
3. Le score vient de RapidFuzz `token_sort_ratio` : les mots sont triés avant la
   comparaison, ce qui rend l'ordre nom/prénoms indifférent
   (« KOUASSI Aya Marie » ≡ « Aya Marie Kouassi ») et tolère les fautes de frappe.
4. Des indices forts affinent le score :
   - même numéro de pièce (comparé par empreinte)  → correspondance certaine (100) ;
   - numéros différents                             → ce n'est pas la même pièce ;
   - dates de naissance différentes                 → candidat écarté ;
   - même date de naissance                         → bonus de +5.
5. Au-delà du seuil (85 par défaut), la correspondance est enregistrée et les deux
   personnes sont prévenues.

La correspondance est lancée à chaque nouvelle déclaration, dans les deux sens.
"""

from dataclasses import dataclass
from datetime import date

from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import FoundDocument, LostReport, Match
from app.models.enums import (
    DOC_TYPE_POSSESSIVE,
    OPEN_STATUSES,
    DeclarationStatus,
    DocType,
    NotificationKind,
    commune_with_preposition,
)
from app.services import notification_service

BIRTH_DATE_BONUS = 5.0


@dataclass(frozen=True)
class Candidate:
    """Vue minimale d'une déclaration, suffisante pour calculer un score.
    Permet de tester le score sans base de données."""

    doc_type: DocType
    name_norm: str
    birth_date: date | None = None
    number_hash: str | None = None


def name_score(name_a: str, name_b: str) -> float:
    """Similarité 0–100 entre deux noms DÉJÀ normalisés."""
    return float(fuzz.token_sort_ratio(name_a, name_b))


def compute_score(a: Candidate, b: Candidate) -> float | None:
    """Score de correspondance entre deux déclarations, ou None si incompatibles."""
    if a.doc_type != b.doc_type:
        return None

    if a.number_hash and b.number_hash:
        # Le numéro est l'indice le plus fiable : il tranche dans les deux sens.
        return 100.0 if a.number_hash == b.number_hash else None

    if a.birth_date and b.birth_date and a.birth_date != b.birth_date:
        return None

    score = name_score(a.name_norm, b.name_norm)
    if a.birth_date and b.birth_date:  # forcément égales à ce stade
        score = min(100.0, score + BIRTH_DATE_BONUS)
    return round(score, 1)


def _as_candidate(declaration: FoundDocument | LostReport) -> Candidate:
    return Candidate(
        doc_type=declaration.doc_type,
        name_norm=declaration.holder_name_norm,
        birth_date=declaration.birth_date,
        number_hash=declaration.number_hash,
    )


def _existing_pair(db: Session, found_id: object, lost_id: object) -> bool:
    return (
        db.scalar(
            select(Match.id).where(
                Match.found_document_id == found_id, Match.lost_report_id == lost_id
            )
        )
        is not None
    )


def _record_match(db: Session, found: FoundDocument, lost: LostReport, score: float) -> Match:
    """Enregistre la correspondance, met à jour les statuts et prévient les deux parties."""
    match = Match(found_document=found, lost_report=lost, score=score)
    db.add(match)

    for declaration in (found, lost):
        if declaration.status == DeclarationStatus.PENDING:
            declaration.status = DeclarationStatus.MATCHED

    relay = found.relay_point
    possessive = DOC_TYPE_POSSESSIVE[found.doc_type]
    notification_service.notify(
        db,
        lost.owner,
        NotificationKind.MATCH,
        title=f"Bonne nouvelle, {possessive} t'attend {commune_with_preposition(relay.commune)} !",
        body=(
            f"Une pièce correspondant à ta déclaration a été déposée chez « {relay.name} ». "
            "Confirme que c'est bien la tienne avec son numéro pour obtenir ton QR code de retrait."
        ),
        link=f"/reclamer/{found.id}",
    )
    notification_service.notify(
        db,
        found.finder,
        NotificationKind.MATCH,
        title="Ta trouvaille a peut-être retrouvé son propriétaire !",
        body=(
            "Quelqu'un a déclaré avoir perdu une pièce qui ressemble à celle que tu as trouvée. "
            "Merci, tu viens de faire une belle action."
        ),
        link="/tableau-de-bord",
    )
    return match


def find_matches_for_found(db: Session, found: FoundDocument) -> list[Match]:
    """Cherche les pertes correspondant à une pièce trouvée."""
    if found.status not in OPEN_STATUSES:
        return []
    candidates = db.scalars(
        select(LostReport).where(
            LostReport.doc_type == found.doc_type,
            LostReport.status.in_(OPEN_STATUSES),
            LostReport.owner_id != found.finder_id,
        )
    ).all()

    reference = _as_candidate(found)
    matches = []
    for lost in candidates:
        score = compute_score(reference, _as_candidate(lost))
        if score is not None and score >= settings.MATCH_THRESHOLD:
            if not _existing_pair(db, found.id, lost.id):
                matches.append(_record_match(db, found, lost, score))
    return matches


def find_matches_for_lost(db: Session, lost: LostReport) -> list[Match]:
    """Cherche les pièces trouvées correspondant à une perte."""
    if lost.status not in OPEN_STATUSES:
        return []
    candidates = db.scalars(
        select(FoundDocument).where(
            FoundDocument.doc_type == lost.doc_type,
            FoundDocument.status.in_(OPEN_STATUSES),
            FoundDocument.finder_id != lost.owner_id,
        )
    ).all()

    reference = _as_candidate(lost)
    matches = []
    for found in candidates:
        score = compute_score(reference, _as_candidate(found))
        if score is not None and score >= settings.MATCH_THRESHOLD:
            if not _existing_pair(db, found.id, lost.id):
                matches.append(_record_match(db, found, lost, score))
    return matches


def explain(found: FoundDocument, lost: LostReport) -> list[str]:
    """Raisons lisibles d'une correspondance (« IA explicable » pour le propriétaire).

    Rien de sensible n'est révélé : on dit QUE les éléments concordent, jamais leur valeur.
    """
    reasons = ["Même type de pièce"]
    if found.number_hash and lost.number_hash and found.number_hash == lost.number_hash:
        reasons.append("Numéro de pièce identique")
    a, b = found.holder_name_norm, lost.holder_name_norm
    if a == b:
        reasons.append("Nom et prénoms identiques")
    elif sorted(a.split()) == sorted(b.split()):
        reasons.append("Mêmes noms, dans un ordre différent")
    else:
        reasons.append(f"Nom très proche ({round(name_score(a, b))} %), faute de frappe tolérée")
    if found.birth_date and lost.birth_date and found.birth_date == lost.birth_date:
        reasons.append("Même date de naissance")
    communes = {found.commune_found, found.relay_point.commune}
    if lost.commune_lost and lost.commune_lost in communes:
        reasons.append("Perdue et retrouvée dans la même commune")
    return reasons
