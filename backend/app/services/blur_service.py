"""Préparation et floutage des photos de pièces avec OpenCV.

Règles de confidentialité appliquées ici :
- l'image est décodée EN MÉMOIRE : l'original n'est jamais écrit dans le dossier media ;
- le ré-encodage supprime toutes les métadonnées (EXIF, coordonnées GPS du téléphone) ;
- les zones sensibles sont floutées de façon IRRÉVERSIBLE (pixellisation puis flou fort) :
  toutes les valeurs lues par l'OCR (nom, dates, numéro, MRZ) et les visages détectés.
  Seuls les en-têtes et libellés restent lisibles, pour que l'agent du point relais
  reconnaisse la pièce.
"""

from collections.abc import Iterable

import cv2
import numpy as np

from app.core.errors import BadRequest

Box = tuple[int, int, int, int]  # x0, y0, x1, y1

MAX_OCR_SIDE = 1600  # au-delà, l'OCR est plus lent sans être plus précis
MAX_STORED_SIDE = 1200
THUMBNAIL_SIDE = 480

_face_detector: cv2.CascadeClassifier | None = None


def decode_image(data: bytes) -> np.ndarray:
    """Décode une image envoyée par l'utilisateur, et la réduit si besoin."""
    buffer = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)  # applique l'orientation EXIF
    if image is None:
        raise BadRequest(
            "Impossible de lire cette image. Essaie une photo JPEG ou PNG bien nette.",
            code="IMAGE_UNREADABLE",
        )
    height, width = image.shape[:2]
    if min(height, width) < 200:
        raise BadRequest("La photo est trop petite : rapproche-toi de la pièce.",
                         code="IMAGE_TOO_SMALL")
    return resize_max(image, MAX_OCR_SIDE)


def resize_max(image: np.ndarray, max_side: int) -> np.ndarray:
    height, width = image.shape[:2]
    scale = max_side / max(height, width)
    if scale >= 1:
        return image
    return cv2.resize(image, (round(width * scale), round(height * scale)),
                      interpolation=cv2.INTER_AREA)


def detect_faces(image: np.ndarray) -> list[Box]:
    """Visages (photo d'identité) avec le détecteur de Haar fourni par OpenCV."""
    global _face_detector
    if _face_detector is None:
        _face_detector = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    min_side = max(24, min(image.shape[:2]) // 12)
    faces = _face_detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5,
                                            minSize=(min_side, min_side))
    boxes: list[Box] = []
    for x, y, w, h in faces:
        # On élargit au cou et aux cheveux : toute la photo d'identité est masquée.
        boxes.append((int(x - w * 0.35), int(y - h * 0.45), int(x + w * 1.35), int(y + h * 1.6)))
    return boxes


def _clip(box: Box, width: int, height: int, pad_ratio: float) -> Box | None:
    x0, y0, x1, y1 = box
    pad = int((y1 - y0) * pad_ratio)
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(width, x1 + pad), min(height, y1 + pad)
    return (x0, y0, x1, y1) if x1 > x0 and y1 > y0 else None


def blur_regions(image: np.ndarray, boxes: Iterable[Box], pad_ratio: float = 0.2) -> np.ndarray:
    """Floute des zones de façon irréversible. Renvoie une copie, l'entrée n'est pas modifiée."""
    output = image.copy()
    height, width = output.shape[:2]
    for raw_box in boxes:
        box = _clip(raw_box, width, height, pad_ratio)
        if box is None:
            continue
        x0, y0, x1, y1 = box
        region = output[y0:y1, x0:x1]
        # 1) pixellisation : détruit l'information ; 2) flou : rend le résultat propre.
        small = cv2.resize(region, (max(1, (x1 - x0) // 14), max(1, (y1 - y0) // 14)),
                           interpolation=cv2.INTER_LINEAR)
        pixelated = cv2.resize(small, (x1 - x0, y1 - y0), interpolation=cv2.INTER_NEAREST)
        kernel = max(3, ((min(x1 - x0, y1 - y0) // 3) | 1))
        output[y0:y1, x0:x1] = cv2.GaussianBlur(pixelated, (kernel, kernel), 0)
    return output


def encode_jpeg(image: np.ndarray, max_side: int = MAX_STORED_SIDE, quality: int = 82) -> bytes:
    """Encode en JPEG sans métadonnées."""
    ok, encoded = cv2.imencode(".jpg", resize_max(image, max_side),
                               [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise BadRequest("Impossible d'enregistrer la photo.", code="IMAGE_ENCODE_FAILED")
    return encoded.tobytes()
