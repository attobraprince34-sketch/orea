"""Lecture automatique des pièces (OCR) et extraction des champs.

Deux étages bien séparés :

1. **Le moteur** (EasyOCR) transforme une image en boîtes de texte
   `TextBox(texte, confiance, position)`. Il est chargé une seule fois (lent :
   quelques secondes) puis réutilisé.
2. **L'analyseur** (`parse_fields`) est une fonction pure : à partir des boîtes, il
   devine le type de pièce, le nom, les prénoms, la date de naissance et le numéro.
   Elle est testée sans charger de modèle.

Stratégie de l'analyseur : on repère les libellés (« Nom », « Prénoms », « Né(e) le »,
« N° … ») puis on prend la valeur la plus proche, en dessous ou à droite. Pour les
passeports, la bande MRZ (« P<XXXNOM<<PRENOMS ») sert de solution de secours.
Chaque champ renvoie un indice de confiance : le formulaire met en évidence ceux
qu'il faut vérifier.
"""

import logging
import re
import threading
from dataclasses import dataclass, field
from datetime import date
from typing import Protocol

import numpy as np

from app.core.config import settings
from app.models.enums import DocType
from app.utils.text import strip_accents

logger = logging.getLogger("orea.ocr")


# ------------------------------------------------------------------------------
# Structures
# ------------------------------------------------------------------------------
@dataclass(frozen=True)
class TextBox:
    text: str
    confidence: float
    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def height(self) -> float:
        return self.y1 - self.y0

    @property
    def norm(self) -> str:
        """Texte en minuscules, sans accents : pour reconnaître les libellés."""
        return re.sub(r"\s+", " ", strip_accents(self.text).lower()).strip()


@dataclass
class FieldGuess:
    value: str | None = None
    confidence: float = 0.0


@dataclass
class ParsedDocument:
    doc_type: FieldGuess = field(default_factory=FieldGuess)
    surname: FieldGuess = field(default_factory=FieldGuess)
    given_names: FieldGuess = field(default_factory=FieldGuess)
    birth_date: FieldGuess = field(default_factory=FieldGuess)
    document_number: FieldGuess = field(default_factory=FieldGuess)

    @property
    def holder_name(self) -> FieldGuess:
        parts = [p.value for p in (self.surname, self.given_names) if p.value]
        if not parts:
            return FieldGuess()
        known = [p.confidence for p in (self.surname, self.given_names) if p.value]
        return FieldGuess(" ".join(parts), round(min(known), 2))


class OcrUnavailable(RuntimeError):
    """Le moteur OCR n'est pas installé ou ses modèles sont introuvables."""


class OcrEngine(Protocol):
    def read(self, image: np.ndarray) -> list[TextBox]: ...


# ------------------------------------------------------------------------------
# Moteur EasyOCR
# ------------------------------------------------------------------------------
class EasyOcrEngine:
    def __init__(self) -> None:
        try:
            import easyocr
        except ImportError as exc:  # dépendance facultative (extra « ocr »)
            raise OcrUnavailable("EasyOCR n'est pas installé.") from exc
        try:
            self._reader = easyocr.Reader(
                settings.OCR_LANGUAGES,
                gpu=False,
                model_storage_directory=settings.OCR_MODEL_DIR,
                download_enabled=settings.OCR_DOWNLOAD_MODELS,
                verbose=False,
            )
        except Exception as exc:
            raise OcrUnavailable(f"Impossible de charger les modèles OCR : {exc}") from exc
        self._lock = threading.Lock()  # le modèle n'est pas prévu pour du parallélisme

    def read(self, image: np.ndarray) -> list[TextBox]:
        with self._lock:
            results = self._reader.readtext(image, paragraph=False)
        boxes = []
        for points, text, confidence in results:
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            if text.strip():
                boxes.append(TextBox(text.strip(), float(confidence),
                                     min(xs), min(ys), max(xs), max(ys)))
        return boxes


_engine: OcrEngine | None = None
_engine_error: str | None = None
_engine_lock = threading.Lock()


def get_engine() -> OcrEngine:
    """Renvoie le moteur partagé (chargé au premier appel)."""
    global _engine, _engine_error
    if not settings.OCR_ENABLED:
        raise OcrUnavailable("La lecture automatique est désactivée.")
    with _engine_lock:
        if _engine is None:
            if _engine_error:
                raise OcrUnavailable(_engine_error)
            try:
                _engine = EasyOcrEngine()
                logger.info("Moteur OCR prêt (%s)", ", ".join(settings.OCR_LANGUAGES))
            except OcrUnavailable as exc:
                _engine_error = str(exc)
                logger.warning("OCR indisponible : %s", exc)
                raise
        return _engine


def set_engine(engine: OcrEngine | None) -> None:
    """Remplace le moteur (utilisé par les tests)."""
    global _engine, _engine_error
    _engine, _engine_error = engine, None


def warm_up() -> None:
    """Précharge le modèle au démarrage pour que le premier scan de la démo soit rapide."""
    try:
        get_engine()
    except OcrUnavailable:
        pass


# ------------------------------------------------------------------------------
# Analyse des champs
# ------------------------------------------------------------------------------
_DOC_TYPE_KEYWORDS: list[tuple[DocType, tuple[str, ...]]] = [
    (DocType.CARTE_GRISE, ("carte grise", "immatriculation")),
    (DocType.ATTESTATION, ("attestation d'identite", "attestation d identite")),
    (DocType.PERMIS, ("permis de conduire", "driving licence", "driving license")),
    (DocType.CARTE_ETUDIANT, ("carte d'etudiant", "carte d etudiant", "etudiant", "student")),
    (DocType.PASSEPORT, ("passeport", "passport")),
    (DocType.CNI, ("carte nationale", "identite", "identity card")),
]

# Libellés, sur le texte normalisé (minuscules, sans accents). Un éventuel numéro
# de rubrique (« 1. Nom ») est retiré avant comparaison.
_LABELS: dict[str, re.Pattern[str]] = {
    "surname": re.compile(r"^(nom|surname|nom de famille)( / surname)?$"),
    "given_names": re.compile(r"^(prenoms?|given names?)( / given names?)?$"),
    # L'OCR confond souvent « l » et « I », et lit « N° » comme « No », « N' » ou « N ».
    "birth_date": re.compile(
        r"^(nee?\(?e?\)? [li]e|date de naissance|date of birth)( / date of birth)?$"
    ),
    "document_number": re.compile(
        r"^(n[°o0º'\"]?\.?|numero|no\.?)\s*(de la carte|du permis|du passeport|de la piece|"
        r"d'immatriculation)?( / passport no\.?)?$|^passport no\.?$"
    ),
}
_OTHER_LABELS = re.compile(r"^(sexe|sex|categories?|nationalite|lieu de naissance|taille|"
                           r"date d'expiration|date d'emission|signature)\b")
_RUBRIC_PREFIX = re.compile(r"^\d{1,2}[.)]\s*")
_DATE = re.compile(r"(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})")
_NUMBER_TOKEN = re.compile(r"\b[A-Z]{0,3}\s?\d[\dA-Z ]{5,20}\b")
_MRZ_NAMES = re.compile(r"^P[<KC(]([A-Z<]{3})([A-Z]+(?:<[A-Z]+)*)<<([A-Z<]+)")
_MRZ_LINE2 = re.compile(r"^([A-Z0-9<]{9})[0-9<]([A-Z<]{3})(\d{6})[0-9<][MF<]")


def _label_kind(box: TextBox) -> str | None:
    text = _RUBRIC_PREFIX.sub("", box.norm).rstrip(" :")
    for kind, pattern in _LABELS.items():
        if pattern.match(text):
            return kind
    if _OTHER_LABELS.match(text):
        return "other"
    return None


def _value_for(label: TextBox, boxes: list[TextBox], labels: set[int]) -> TextBox | None:
    """Boîte valeur la plus proche : juste en dessous (alignée) ou à droite (même ligne)."""
    best: tuple[float, TextBox] | None = None
    for i, box in enumerate(boxes):
        if i in labels or box is label:
            continue
        below = (0 <= box.y0 - label.y1 <= 2.5 * label.height
                 and abs(box.x0 - label.x0) <= max(label.height * 3, 40))
        right = (abs((box.y0 + box.y1) / 2 - (label.y0 + label.y1) / 2) <= label.height * 0.7
                 and 0 <= box.x0 - label.x1 <= label.height * 12)
        if below or right:
            distance = (box.y0 - label.y1) if below else (box.x0 - label.x1) * 0.5
            if best is None or distance < best[0]:
                best = (distance, box)
    return best[1] if best else None


def _clean_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-zÀ-ÖØ-öø-ÿ' \-]", "", value)
    return re.sub(r"\s+", " ", cleaned).strip().upper()


def _parse_date(value: str) -> str | None:
    match = _DATE.search(value)
    if not match:
        return None
    day, month, year = (int(g) for g in match.groups())
    try:
        parsed = date(year, month, day)
    except ValueError:
        return None
    if not 1900 <= parsed.year <= date.today().year:
        return None
    return parsed.isoformat()


def _clean_number(value: str) -> str | None:
    cleaned = re.sub(r"[^A-Z0-9 ]", "", value.upper()).strip()
    compact = cleaned.replace(" ", "")
    if 5 <= len(compact) <= 30 and any(c.isdigit() for c in compact):
        return re.sub(r"\s+", " ", cleaned)
    return None


def detect_doc_type(boxes: list[TextBox]) -> FieldGuess:
    full_text = " ".join(b.norm for b in boxes)
    for doc_type, keywords in _DOC_TYPE_KEYWORDS:
        for keyword in keywords:
            if keyword in full_text:
                confidence = max((b.confidence for b in boxes if keyword in b.norm), default=0.6)
                return FieldGuess(doc_type.value, round(confidence, 2))
    return FieldGuess()


def parse_fields(boxes: list[TextBox]) -> ParsedDocument:
    """Transforme les boîtes OCR en champs du formulaire « J'ai trouvé »."""
    result = ParsedDocument(doc_type=detect_doc_type(boxes))
    kinds = {i: _label_kind(b) for i, b in enumerate(boxes)}
    label_indexes = {i for i, k in kinds.items() if k}

    for i, kind in kinds.items():
        if kind in (None, "other"):
            continue
        value_box = _value_for(boxes[i], boxes, label_indexes)
        if value_box is None:
            continue
        confidence = round(min(value_box.confidence, boxes[i].confidence + 0.2), 2)
        target: FieldGuess = getattr(result, kind)
        if target.value:  # premier libellé trouvé = le bon
            continue
        if kind in ("surname", "given_names"):
            name = _clean_name(value_box.text)
            if len(name) >= 2:
                setattr(result, kind, FieldGuess(name, confidence))
        elif kind == "birth_date":
            parsed = _parse_date(value_box.text)
            if parsed:
                setattr(result, kind, FieldGuess(parsed, confidence))
        elif kind == "document_number":
            number = _clean_number(value_box.text)
            if number:
                setattr(result, kind, FieldGuess(number, confidence))

    _fill_from_mrz(result, boxes)
    _fill_from_mrz_line2(result, boxes)
    _fill_fallbacks(result, boxes, label_indexes)
    return result


def _fill_from_mrz_line2(result: ParsedDocument, boxes: list[TextBox]) -> None:
    """2e ligne de la MRZ d'un passeport (norme OACI 9303) :
    numéro (9) · contrôle · nationalité (3) · naissance AAMMJJ · contrôle · sexe · …

    Elle reste souvent lisible quand la zone visuelle est abîmée ou masquée.
    """
    if result.birth_date.value and result.document_number.value:
        return
    for box in boxes:
        match = _MRZ_LINE2.match(box.text.replace(" ", "").upper())
        if not match:
            continue
        confidence = round(max(box.confidence, 0.5) * 0.8, 2)
        if not result.birth_date.value:
            yy, mm, dd = (int(match.group(3)[i:i + 2]) for i in (0, 2, 4))
            century = 1900 if yy > date.today().year % 100 else 2000
            try:
                result.birth_date = FieldGuess(date(century + yy, mm, dd).isoformat(),
                                               confidence)
            except ValueError:
                pass
        if not result.document_number.value:
            number = _clean_number(match.group(1).replace("<", ""))
            if number:
                result.document_number = FieldGuess(number, confidence)
        return


def _fill_from_mrz(result: ParsedDocument, boxes: list[TextBox]) -> None:
    """Passeports : la bande MRZ donne nom et prénoms si les libellés ont échoué."""
    if result.surname.value and result.given_names.value:
        return
    for box in boxes:
        compact = box.text.replace(" ", "").upper()
        match = _MRZ_NAMES.match(compact)
        if not match:
            continue
        surname = match.group(2).replace("<", " ").strip()
        given = match.group(3).replace("<", " ").strip()
        confidence = round(box.confidence * 0.9, 2)
        if not result.surname.value and surname:
            result.surname = FieldGuess(surname, confidence)
        if not result.given_names.value and given:
            result.given_names = FieldGuess(given, confidence)
        if not result.doc_type.value:
            result.doc_type = FieldGuess(DocType.PASSEPORT.value, confidence)
        return


def _fill_fallbacks(result: ParsedDocument, boxes: list[TextBox], labels: set[int]) -> None:
    """Sans libellé exploitable : première date plausible, premier numéro plausible."""
    values = [b for i, b in enumerate(boxes) if i not in labels]
    if not result.birth_date.value:
        for box in values:
            parsed = _parse_date(box.text)
            if parsed:
                result.birth_date = FieldGuess(parsed, round(box.confidence * 0.6, 2))
                break
    if not result.document_number.value:
        for box in values:
            if _MRZ_NAMES.match(box.text.replace(" ", "")) or _DATE.search(box.text):
                continue
            match = _NUMBER_TOKEN.search(box.text.upper())
            number = _clean_number(match.group(0)) if match else None
            if number:
                result.document_number = FieldGuess(number, round(box.confidence * 0.6, 2))
                break


# Textes non sensibles qu'il est inutile de flouter (en-têtes, libellés, mentions).
_PUBLIC_TEXT = re.compile(
    r"(carte nationale|identite|passeport|passport|permis|conduire|etudiant|carte grise|"
    r"attestation|specimen|document fictif|projet|republique|sans valeur)"
)


def is_sensitive(box: TextBox) -> bool:
    """Une boîte est sensible sauf si c'est un libellé ou un en-tête connu."""
    return _label_kind(box) is None and not _PUBLIC_TEXT.search(box.norm)
