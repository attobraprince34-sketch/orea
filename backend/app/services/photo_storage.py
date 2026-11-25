"""Stockage privé des photos FLOUTÉES.

    MEDIA_DIR/
      pending/<id utilisateur>/<upload_id>.jpg   photo floutée en attente (1 h max)
      found/<id pièce trouvée>.jpg               photo rattachée à une déclaration

Ce dossier n'est jamais servi publiquement : seule la route protégée
GET /found/{id}/photo y accède, après contrôle des droits.
"""

import re
import time
import uuid
from pathlib import Path

from app.core.config import settings
from app.core.errors import BadRequest

_UPLOAD_ID = re.compile(r"^[0-9a-f]{32}$")


def _root() -> Path:
    return Path(settings.MEDIA_DIR).resolve()


def _pending_path(user_id: uuid.UUID, upload_id: str) -> Path:
    # L'identifiant est strictement contrôlé : aucune traversée de dossier possible.
    if not _UPLOAD_ID.match(upload_id):
        raise BadRequest("Identifiant de photo invalide.", code="UPLOAD_INVALID")
    return _root() / "pending" / str(user_id) / f"{upload_id}.jpg"


def save_pending(user_id: uuid.UUID, jpeg: bytes) -> str:
    upload_id = uuid.uuid4().hex
    path = _pending_path(user_id, upload_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(jpeg)
    return upload_id


def attach_to_found(user_id: uuid.UUID, upload_id: str, found_id: uuid.UUID) -> str:
    """Rattache une photo en attente à une pièce trouvée. Renvoie le chemin relatif."""
    source = _pending_path(user_id, upload_id)
    if not source.exists():
        raise BadRequest(
            "La photo a expiré ou n'a pas été trouvée. Reprends-la, ça ne prend qu'une seconde.",
            code="UPLOAD_EXPIRED",
        )
    relative = Path("found") / f"{found_id}.jpg"
    target = _root() / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    source.replace(target)
    return relative.as_posix()


def absolute(relative_path: str) -> Path | None:
    path = (_root() / relative_path).resolve()
    if _root() not in path.parents or not path.exists():
        return None
    return path


def delete(relative_path: str | None) -> None:
    if relative_path and (path := absolute(relative_path)):
        path.unlink(missing_ok=True)


def purge_pending(max_age_minutes: int | None = None) -> int:
    """Supprime les photos en attente jamais rattachées à une déclaration."""
    max_age = (max_age_minutes or settings.PENDING_UPLOAD_TTL_MINUTES) * 60
    pending = _root() / "pending"
    if not pending.exists():
        return 0
    now, removed = time.time(), 0
    for file in pending.glob("*/*.jpg"):
        if now - file.stat().st_mtime > max_age:
            file.unlink(missing_ok=True)
            removed += 1
    return removed
