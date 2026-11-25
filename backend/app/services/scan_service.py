"""Parcours « photo d'une pièce trouvée » : OCR → floutage → stockage de la seule
version floutée.

    image envoyée ──► décodée en mémoire ──► OCR ──► champs pré-remplis
                                     │
                                     └─► zones sensibles floutées ──► JPEG sans EXIF
                                                                      (dossier privé)
    L'original n'existe qu'en mémoire, le temps de la requête, et il est effacé dans
    un bloc `finally`, même en cas d'erreur.
"""

import base64
import logging
import time
import uuid
from dataclasses import dataclass

import numpy as np

from app.core.config import settings
from app.services import blur_service, ocr_service, photo_storage
from app.services.ocr_service import OcrUnavailable, ParsedDocument

logger = logging.getLogger("orea.scan")


@dataclass
class ScanResult:
    ocr_available: bool
    parsed: ParsedDocument
    upload_id: str | None
    preview_data_uri: str | None
    blurred_regions: int
    duration_ms: int


def scan_document(user_id: uuid.UUID, data: bytes) -> ScanResult:
    started = time.perf_counter()
    image: np.ndarray | None = None
    try:
        image = blur_service.decode_image(data)

        try:
            boxes = ocr_service.get_engine().read(image)
        except OcrUnavailable:
            # Sans OCR, impossible de savoir où sont les données personnelles :
            # par prudence, la photo n'est pas conservée du tout.
            return ScanResult(False, ParsedDocument(), None, None, 0, _ms(started))

        parsed = ocr_service.parse_fields(boxes)
        regions = [
            (int(b.x0), int(b.y0), int(b.x1), int(b.y1))
            for b in boxes
            if ocr_service.is_sensitive(b)
        ] + blur_service.detect_faces(image)
        redacted = blur_service.blur_regions(image, regions)

        upload_id = photo_storage.save_pending(user_id, blur_service.encode_jpeg(redacted))
        thumbnail = blur_service.encode_jpeg(redacted, blur_service.THUMBNAIL_SIDE, quality=70)
        preview = "data:image/jpeg;base64," + base64.b64encode(thumbnail).decode()

        logger.info("Scan : %s zones de texte, %s floutées, %s ms",
                    len(boxes), len(regions), _ms(started))
        return ScanResult(True, parsed, upload_id, preview, len(regions), _ms(started))
    finally:
        # L'original ne survit pas à la requête.
        del image
        del data


def needs_review(confidence: float, value: str | None) -> bool:
    return value is None or confidence < settings.OCR_REVIEW_THRESHOLD


def _ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)
