"""Limitation du nombre de requêtes (anti-abus) avec slowapi.

Les routes sensibles (recherche, vérification du numéro, scan de QR, connexion)
sont décorées avec `@limiter.limit(...)`. La clé est l'adresse IP du client.
Le stockage est en mémoire : suffisant pour une instance unique ; en production
multi-instances, on passerait `storage_uri="redis://..."`.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.RATE_LIMIT_ENABLED,
    headers_enabled=False,
)
