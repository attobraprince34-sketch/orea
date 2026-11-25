"""Import centralisé : Alembic et les tests ont besoin de tous les modèles chargés."""

from app.models.activity import AuditLog, Notification
from app.models.claims import Claim, ClaimAttempt, PickupCode
from app.models.declarations import FoundDocument, LostReport, Match
from app.models.user import RefreshToken, RelayPoint, User

__all__ = [
    "AuditLog",
    "Claim",
    "ClaimAttempt",
    "FoundDocument",
    "LostReport",
    "Match",
    "Notification",
    "PickupCode",
    "RefreshToken",
    "RelayPoint",
    "User",
]
