"""Test d'intégration avec le VRAI modèle EasyOCR sur les 3 spécimens.

Lent (chargement du modèle) : exclu par défaut, à lancer avec  pytest -m slow
"""

from pathlib import Path

import pytest

from app.services import blur_service, ocr_service

pytestmark = pytest.mark.slow

SPECIMENS = Path(__file__).resolve().parent.parent / "specimens"

EXPECTED = {
    "specimen_cni.jpg": ("cni", "KOUASSI AYA MARIE", "1998-04-12", "CI0099123456"),
    "specimen_permis.jpg": ("permis", "KONAN YAO FABRICE", "1990-09-03", "AB45217788"),
    "specimen_passeport.jpg": ("passeport", "TRAORE AWA", "1995-07-21", "20AB12345"),
}


@pytest.fixture(scope="module")
def engine() -> ocr_service.OcrEngine:
    # Import ici (et pas en tête de fichier) : PyTorch n'est chargé que si ce test tourne.
    pytest.importorskip("easyocr")
    ocr_service.set_engine(None)
    try:
        return ocr_service.get_engine()
    except ocr_service.OcrUnavailable as exc:
        pytest.skip(str(exc))


@pytest.mark.parametrize("filename", list(EXPECTED))
def test_specimen_is_read(engine: ocr_service.OcrEngine, filename: str) -> None:
    doc_type, name, birth, number = EXPECTED[filename]
    image = blur_service.decode_image((SPECIMENS / filename).read_bytes())
    parsed = ocr_service.parse_fields(engine.read(image))

    assert parsed.doc_type.value == doc_type
    assert parsed.holder_name.value is not None
    assert parsed.holder_name.value.replace("É", "E") == name
    assert parsed.birth_date.value == birth
    assert (parsed.document_number.value or "").replace(" ", "") == number
