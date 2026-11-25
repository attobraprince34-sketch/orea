"""Énumérations métier et libellés affichables en français."""

from enum import StrEnum


class Role(StrEnum):
    USER = "user"
    RELAY = "relay"
    ADMIN = "admin"


class DocType(StrEnum):
    CNI = "cni"
    PASSEPORT = "passeport"
    PERMIS = "permis"
    CARTE_ETUDIANT = "carte_etudiant"
    CARTE_GRISE = "carte_grise"
    ATTESTATION = "attestation"


class Commune(StrEnum):
    """Les 13 communes du District autonome d'Abidjan."""

    ABOBO = "abobo"
    ADJAME = "adjame"
    ANYAMA = "anyama"
    ATTECOUBE = "attecoube"
    BINGERVILLE = "bingerville"
    COCODY = "cocody"
    KOUMASSI = "koumassi"
    MARCORY = "marcory"
    PLATEAU = "plateau"
    PORT_BOUET = "port_bouet"
    SONGON = "songon"
    TREICHVILLE = "treichville"
    YOPOUGON = "yopougon"


class DeclarationStatus(StrEnum):
    """Cycle de vie : pending → matched → claimed → returned (ou expired).
    `cancelled` couvre le retrait par l'auteur et la modération."""

    PENDING = "pending"
    MATCHED = "matched"
    CLAIMED = "claimed"
    RETURNED = "returned"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class ClaimStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class NotificationKind(StrEnum):
    MATCH = "match"
    RECEIVED = "received"
    CLAIM = "claim"
    RETURNED = "returned"
    SYSTEM = "system"


# Statuts pendant lesquels une déclaration peut encore être appariée ou réclamée.
OPEN_STATUSES = (DeclarationStatus.PENDING, DeclarationStatus.MATCHED)

DOC_TYPE_LABELS: dict[DocType, str] = {
    DocType.CNI: "Carte nationale d'identité",
    DocType.PASSEPORT: "Passeport",
    DocType.PERMIS: "Permis de conduire",
    DocType.CARTE_ETUDIANT: "Carte d'étudiant",
    DocType.CARTE_GRISE: "Carte grise",
    DocType.ATTESTATION: "Attestation d'identité",
}

# Possessif accordé, pour des messages naturels : « ta CNI », « ton passeport »…
DOC_TYPE_POSSESSIVE: dict[DocType, str] = {
    DocType.CNI: "ta CNI",
    DocType.PASSEPORT: "ton passeport",
    DocType.PERMIS: "ton permis",
    DocType.CARTE_ETUDIANT: "ta carte d'étudiant",
    DocType.CARTE_GRISE: "ta carte grise",
    DocType.ATTESTATION: "ton attestation d'identité",
}

# Genre grammatical, pour accorder les messages (« arrivée » / « arrivé »).
FEMININE_DOC_TYPES = frozenset(
    {DocType.CNI, DocType.CARTE_ETUDIANT, DocType.CARTE_GRISE, DocType.ATTESTATION}
)


def agree(doc_type: DocType, feminine: str, masculine: str) -> str:
    return feminine if doc_type in FEMININE_DOC_TYPES else masculine


# Nom affiché et forme avec préposition : « à Cocody », mais « au Plateau ».
COMMUNE_LABELS: dict[Commune, tuple[str, str]] = {
    Commune.ABOBO: ("Abobo", "à Abobo"),
    Commune.ADJAME: ("Adjamé", "à Adjamé"),
    Commune.ANYAMA: ("Anyama", "à Anyama"),
    Commune.ATTECOUBE: ("Attécoubé", "à Attécoubé"),
    Commune.BINGERVILLE: ("Bingerville", "à Bingerville"),
    Commune.COCODY: ("Cocody", "à Cocody"),
    Commune.KOUMASSI: ("Koumassi", "à Koumassi"),
    Commune.MARCORY: ("Marcory", "à Marcory"),
    Commune.PLATEAU: ("Plateau", "au Plateau"),
    Commune.PORT_BOUET: ("Port-Bouët", "à Port-Bouët"),
    Commune.SONGON: ("Songon", "à Songon"),
    Commune.TREICHVILLE: ("Treichville", "à Treichville"),
    Commune.YOPOUGON: ("Yopougon", "à Yopougon"),
}

STATUS_LABELS: dict[DeclarationStatus, str] = {
    DeclarationStatus.PENDING: "En attente",
    DeclarationStatus.MATCHED: "Correspondance trouvée",
    DeclarationStatus.CLAIMED: "Réclamée",
    DeclarationStatus.RETURNED: "Restituée",
    DeclarationStatus.EXPIRED: "Expirée",
    DeclarationStatus.CANCELLED: "Annulée",
}


def commune_label(commune: Commune | str | None) -> str:
    return COMMUNE_LABELS[Commune(commune)][0] if commune else ""


def commune_with_preposition(commune: Commune | str) -> str:
    return COMMUNE_LABELS[Commune(commune)][1]
