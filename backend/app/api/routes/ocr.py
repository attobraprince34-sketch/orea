"""Scan d'une pièce trouvée : OCR + floutage."""

from typing import Annotated

from fastapi import APIRouter, File, Request, UploadFile

from app.api.deps import CurrentUser
from app.core.config import settings
from app.core.errors import BadRequest
from app.core.rate_limit import limiter
from app.schemas.ocr import ScanOut
from app.services import scan_service

router = APIRouter(prefix="/ocr", tags=["Lecture automatique (OCR)"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post(
    "/scan",
    response_model=ScanOut,
    summary="Lire une pièce trouvée et flouter sa photo",
    description=(
        "Reçoit la photo d'une pièce, en extrait les champs (type, nom, prénoms, date de "
        "naissance, numéro) et renvoie un identifiant de photo **floutée**. L'original "
        "n'est jamais enregistré. Limité à 10 scans par minute."
    ),
)
@limiter.limit(settings.RATE_LIMIT_OCR)
def scan(
    request: Request,
    user: CurrentUser,
    file: Annotated[UploadFile, File(description="Photo JPEG, PNG ou WebP")],
) -> ScanOut:
    try:
        if file.content_type not in ALLOWED_TYPES:
            raise BadRequest("Format non pris en charge : envoie une photo JPEG, PNG ou WebP.",
                             code="IMAGE_FORMAT")
        max_bytes = settings.OCR_MAX_UPLOAD_MB * 1024 * 1024
        data = file.file.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise BadRequest(f"Photo trop lourde ({settings.OCR_MAX_UPLOAD_MB} Mo maximum).",
                             code="IMAGE_TOO_LARGE")
        return ScanOut.of(scan_service.scan_document(user.id, data))
    finally:
        # Le fichier temporaire de l'envoi (éventuellement écrit sur disque par le
        # serveur) est fermé, donc supprimé, dans tous les cas.
        file.file.close()
