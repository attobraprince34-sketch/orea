"""Données de démonstration d'Orea (100 % fictives).

    python -m scripts.seed              # ajoute les données (base vide conseillée)
    python -m scripts.seed --if-empty   # ne fait rien si des comptes existent déjà
    python -m scripts.seed --reset      # vide toutes les tables puis recrée tout

Contenu :
- 6 points relais dans de vraies communes d'Abidjan (noms et numéros fictifs) ;
- des comptes de test pour chaque rôle (mot de passe commun : Orea2026!) ;
- ~30 jours d'historique (déclarations, correspondances, restitutions) pour les
  graphiques du tableau de bord ;
- le scénario de démo : Aya a perdu sa CNI. Scanner le « spécimen CNI » déclenche
  la correspondance en direct devant le jury.
"""

import argparse
import random
import uuid
from datetime import date, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.security import hash_doc_number, hash_password
from app.db.base import Base, utcnow
from app.db.session import SessionLocal
from app.models import (
    AuditLog,
    Claim,
    FoundDocument,
    LostReport,
    Match,
    Notification,
    PickupCode,
    RelayPoint,
    User,
)
from app.models.enums import (
    ClaimStatus,
    Commune,
    DeclarationStatus,
    DocType,
    NotificationKind,
    Role,
)
from app.services import qr_service
from app.utils.text import initials, normalize_name

DEMO_PASSWORD = "Orea2026!"
rng = random.Random(2026)  # reproductible : même jeu de données à chaque fois

RELAY_POINTS = [
    # (commune, nom, adresse, latitude, longitude, téléphone)
    (Commune.COCODY, "Relais Orea · Cocody Deux-Plateaux", "Rue des Jardins, Deux-Plateaux Vallon", 5.3722, -4.0003, "+225 27 22 00 10 01"),
    (Commune.PLATEAU, "Relais Orea · Plateau Cité administrative", "Avenue Chardy, près de la Cité administrative", 5.3236, -4.0198, "+225 27 20 00 10 02"),
    (Commune.YOPOUGON, "Relais Orea · Yopougon Siporex", "Carrefour Siporex, Yopougon", 5.3420, -4.0760, "+225 27 23 00 10 03"),
    (Commune.ABOBO, "Relais Orea · Abobo Gare", "Boulevard de la gare, Abobo", 5.4185, -4.0205, "+225 27 24 00 10 04"),
    (Commune.MARCORY, "Relais Orea · Marcory Zone 4", "Rue du Docteur Blanchard, Zone 4", 5.2935, -3.9802, "+225 27 21 00 10 05"),
    (Commune.TREICHVILLE, "Relais Orea · Treichville Arras", "Avenue 16, près du marché d'Arras", 5.2962, -4.0088, "+225 27 21 00 10 06"),
]

# Noms et prénoms courants, combinés au hasard : aucune personne réelle n'est visée.
SURNAMES = ["KOUAME", "KONE", "TRAORE", "OUATTARA", "YAO", "KOFFI", "DIABATE", "BAMBA",
            "N'GUESSAN", "COULIBALY", "TOURE", "AKA", "ESSIS", "ASSI", "DIALLO", "SORO",
            "ACHI", "BROU", "KOUADIO", "TANOH"]
FIRST_NAMES = ["Adjoua", "Mariam", "Fatou", "Akissi", "Awa", "Aminata", "Christelle", "Grâce",
               "Ibrahim", "Moussa", "Serge", "Hervé", "Jean-Marc", "Yannick", "Seydou",
               "Désiré", "Ange", "Prisca", "Josiane", "Arsène"]
DOC_WEIGHTS = [(DocType.CNI, 40), (DocType.PERMIS, 18), (DocType.CARTE_ETUDIANT, 16),
               (DocType.PASSEPORT, 10), (DocType.CARTE_GRISE, 9), (DocType.ATTESTATION, 7)]
COMMUNE_WEIGHTS = [(Commune.YOPOUGON, 18), (Commune.ABOBO, 15), (Commune.COCODY, 14),
                   (Commune.ADJAME, 12), (Commune.PLATEAU, 10), (Commune.TREICHVILLE, 9),
                   (Commune.MARCORY, 8), (Commune.KOUMASSI, 7), (Commune.PORT_BOUET, 4),
                   (Commune.ATTECOUBE, 3)]


def weighted(choices: list[tuple[object, int]]) -> object:
    return rng.choices([c for c, _ in choices], weights=[w for _, w in choices])[0]


def fake_name() -> str:
    return f"{rng.choice(SURNAMES)} {rng.choice(FIRST_NAMES)}"


def fake_number(doc_type: DocType) -> str:
    prefix = {DocType.CNI: "CI", DocType.PASSEPORT: "20", DocType.PERMIS: "PC"}.get(doc_type, "XX")
    return f"{prefix}{rng.randint(10**8, 10**9 - 1)}"


def reset(db: Session) -> None:
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(delete(table))
    db.commit()


def seed(db: Session) -> None:
    password_hash = hash_password(DEMO_PASSWORD)  # bcrypt est lent : un seul calcul

    def audit(action: str, at: object, target: object = None) -> None:
        """Historique d'actions : alimente le flux « en direct » du centre de contrôle."""
        db.add(AuditLog(action=action, target=str(target) if target else None, meta={},
                        created_at=at))

    def user(email: str, name: str, role: Role = Role.USER, relay: RelayPoint | None = None,
             phone: str | None = None) -> User:
        account = User(email=email, password_hash=password_hash, full_name=name, role=role,
                       relay_point_id=relay.id if relay else None, phone=phone)
        db.add(account)
        return account

    # --- Points relais et agents ------------------------------------------------------
    relays: dict[Commune, RelayPoint] = {}
    for commune, name, address, lat, lon, phone in RELAY_POINTS:
        relay = RelayPoint(name=name, commune=commune, address=address, latitude=lat,
                           longitude=lon, phone=phone,
                           opening_hours="Lun–Sam · 8h–18h" if commune in (Commune.YOPOUGON, Commune.ABOBO) else "Lun–Ven · 8h–17h")
        db.add(relay)
        relays[commune] = relay
    db.flush()

    user("admin@orea.ci", "Admin Orea", Role.ADMIN)
    for commune, relay in relays.items():
        user(f"relais.{commune.value}@orea.ci", f"Agent {relay.name.split('· ')[1]}", Role.RELAY, relay)

    # --- Personnages du scénario de démo ---------------------------------------------------
    aya = user("aya@orea.ci", "Aya Kouassi", phone="+225 07 07 00 00 01")
    koffi = user("koffi@orea.ci", "Koffi Yao", phone="+225 05 05 00 00 02")
    fabrice = user("fabrice@orea.ci", "Fabrice Konan", phone="+225 01 01 00 00 03")
    awa = user("awa@orea.ci", "Awa Traoré", phone="+225 07 08 00 00 04")
    citizens = [user(f"citoyen{i}@orea.ci", fake_name().title()) for i in range(1, 19)]
    db.flush()

    # Pertes « en attente » qui correspondent aux 3 spécimens (scannés pendant la démo).
    for owner, doc_type, holder, birth, commune in [
        (aya, DocType.CNI, "Aya Marie Kouassi", date(1998, 4, 12), Commune.COCODY),
        (fabrice, DocType.PERMIS, "Fabrice Yao Konan", date(1990, 9, 3), Commune.PLATEAU),
        (awa, DocType.PASSEPORT, "Awa Traoré", date(1995, 7, 21), Commune.MARCORY),
    ]:
        db.add(LostReport(owner_id=owner.id, doc_type=doc_type, holder_name=holder,
                          holder_name_norm=normalize_name(holder), holder_initials=initials(holder),
                          birth_date=birth, commune_lost=commune,
                          lost_on=date.today() - timedelta(days=3),
                          created_at=utcnow() - timedelta(days=2, hours=5)))
    db.add(Notification(user_id=aya.id, kind=NotificationKind.SYSTEM,
                        title="Ta déclaration est enregistrée",
                        body="Ori garde l'œil ouvert : on te prévient dès que ta CNI refait surface.",
                        link="/tableau-de-bord", created_at=utcnow() - timedelta(days=2, hours=5)))

    # --- Historique sur 30 jours (graphiques de l'admin, statistiques de la landing) ---------
    finders = [koffi, *citizens[:10]]
    owners = citizens[10:]
    relay_list = list(relays.values())
    for _ in range(58):
        days_ago = rng.randint(0, 29)
        created = utcnow() - timedelta(days=days_ago, hours=rng.randint(0, 20))
        doc_type = weighted(DOC_WEIGHTS)
        holder = fake_name()
        relay = rng.choice(relay_list)
        found = FoundDocument(
            finder_id=rng.choice(finders).id, relay_point_id=relay.id, doc_type=doc_type,
            holder_name=holder, holder_name_norm=normalize_name(holder),
            holder_initials=initials(holder),
            birth_date=date(rng.randint(1965, 2005), rng.randint(1, 12), rng.randint(1, 28)),
            number_hash=hash_doc_number(fake_number(doc_type)),  # type: ignore[arg-type]
            commune_found=weighted(COMMUNE_WEIGHTS), found_on=created.date(),
            created_at=created, updated_at=created,
        )
        db.add(found)
        db.flush()
        audit("found.created", created, found.id)

        roll = rng.random()
        if days_ago >= 1 and roll < 0.62:
            found.received_at = created + timedelta(hours=rng.randint(2, 30))
            audit("found.received", found.received_at, found.id)
        if days_ago >= 3 and roll < 0.42:
            # Histoire complète : perte déclarée → correspondance → QR → restitution.
            owner = rng.choice(owners)
            lost = LostReport(owner_id=owner.id, doc_type=doc_type, holder_name=holder.title(),
                              holder_name_norm=normalize_name(holder), holder_initials=initials(holder),
                              birth_date=found.birth_date, status=DeclarationStatus.RETURNED,
                              created_at=created - timedelta(days=rng.randint(0, 3)))
            db.add(lost)
            db.flush()
            db.add(Match(found_document_id=found.id, lost_report_id=lost.id,
                         score=rng.choice([100.0, 96.0, 92.5, 89.0]), created_at=created))
            returned_at = created + timedelta(days=rng.uniform(1, min(days_ago, 6)))
            found.status = DeclarationStatus.RETURNED
            found.returned_at = returned_at
            claim = Claim(found_document_id=found.id, claimant_id=owner.id, lost_report_id=lost.id,
                          status=ClaimStatus.COMPLETED, completed_at=returned_at,
                          created_at=returned_at - timedelta(hours=20))
            db.add(claim)
            db.flush()
            audit("claim.verified", claim.created_at, claim.id)
            audit("pickup.scanned", returned_at - timedelta(minutes=2), claim.id)
            audit("pickup.completed", returned_at, claim.id)
            code = PickupCode(id=uuid.uuid4(), claim_id=claim.id, nonce=qr_service.new_nonce(),
                              expires_at=claim.created_at + timedelta(days=14), used_at=returned_at,
                              token_hash="", short_code_hash="")
            token = qr_service.derive_token(code.id, code.nonce)
            code.token_hash = qr_service.token_hash(token)
            code.short_code_hash = qr_service.short_code_hash(qr_service.short_code_from_token(token))
            db.add(code)
        elif roll < 0.52:
            found.status = DeclarationStatus.MATCHED
            owner = rng.choice(owners)
            lost = LostReport(owner_id=owner.id, doc_type=doc_type, holder_name=holder.title(),
                              holder_name_norm=normalize_name(holder), holder_initials=initials(holder),
                              status=DeclarationStatus.MATCHED, created_at=created)
            db.add(lost)
            db.flush()
            db.add(Match(found_document_id=found.id, lost_report_id=lost.id, score=94.0,
                         created_at=created))

    # Quelques pertes encore sans correspondance.
    for _ in range(14):
        holder = fake_name()
        doc_type = weighted(DOC_WEIGHTS)
        db.add(LostReport(owner_id=rng.choice(owners).id, doc_type=doc_type, holder_name=holder.title(),
                          holder_name_norm=normalize_name(holder), holder_initials=initials(holder),
                          commune_lost=weighted(COMMUNE_WEIGHTS),
                          created_at=utcnow() - timedelta(days=rng.randint(0, 29))))
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Données de démonstration d'Orea")
    parser.add_argument("--reset", action="store_true", help="vide toutes les tables avant")
    parser.add_argument("--if-empty", action="store_true", help="ne fait rien si la base contient des comptes")
    args = parser.parse_args()

    with SessionLocal() as db:
        if args.reset:
            reset(db)
            print("Base vidée.")
        elif args.if_empty and db.scalar(select(func.count()).select_from(User)):
            print("Données déjà présentes : seed ignoré.")
            return
        seed(db)
        users = db.scalar(select(func.count()).select_from(User))
        found = db.scalar(select(func.count()).select_from(FoundDocument))
        print(f"Seed terminé : {users} comptes, {found} pièces trouvées, 6 points relais.")
        print(f"Mot de passe de tous les comptes de démo : {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
