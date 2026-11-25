"""Tests de l'analyse des champs OCR (fonction pure, sans modèle)."""

from app.services.ocr_service import detect_doc_type, is_sensitive, parse_fields
from tests.ocr_fixtures import CNI_BOXES, PASSPORT_BOXES, PERMIS_BOXES, box


def test_cni_fields_are_extracted() -> None:
    parsed = parse_fields(CNI_BOXES)
    assert parsed.doc_type.value == "cni"
    assert parsed.surname.value == "KOUASSI"
    assert parsed.given_names.value == "AYA MARIE"
    assert parsed.holder_name.value == "KOUASSI AYA MARIE"
    assert parsed.birth_date.value == "1998-04-12"
    assert parsed.document_number.value == "CI 0099 1234 56"


def test_low_confidence_is_reported() -> None:
    parsed = parse_fields(CNI_BOXES)
    assert parsed.birth_date.confidence < 0.75  # boîte lue avec 62 % de confiance
    assert parsed.surname.confidence >= 0.9


def test_numbered_labels_on_driving_licence() -> None:
    parsed = parse_fields(PERMIS_BOXES)
    assert parsed.doc_type.value == "permis"
    assert parsed.holder_name.value == "KONAN YAO FABRICE"
    assert parsed.birth_date.value == "1990-09-03"
    assert parsed.document_number.value == "AB 4521 7788"


def test_passport_falls_back_on_mrz_for_names() -> None:
    parsed = parse_fields(PASSPORT_BOXES)
    assert parsed.doc_type.value == "passeport"
    assert parsed.surname.value == "TRAORE"
    assert parsed.given_names.value == "AWA"
    assert parsed.birth_date.value == "1995-07-21"
    assert parsed.document_number.value == "20AB12345"


def test_passport_birth_date_from_mrz_when_visual_zone_is_hidden() -> None:
    """Cas réel : sur le spécimen, la date est masquée par le filigrane « SPÉCIMEN »."""
    boxes = [b for b in PASSPORT_BOXES if b.text != "21/07/1995"]
    boxes.append(box("nmnos_", 286, 286, 280, 190, conf=0.06))
    parsed = parse_fields(boxes)
    assert parsed.birth_date.value == "1995-07-21"
    assert parsed.document_number.value == "20AB12345"


def test_common_misreads_are_tolerated() -> None:
    boxes = [
        box("CARTE NATIONALE D'IDENTITE", 0, 0, 400),
        box("Ne(e) Ie", 0, 100, 80, 22),  # « l » lu comme « I »
        box("01.02.2000", 0, 126, 150, 30),
        box("No de la carte", 0, 200, 140, 22),  # « N° » lu comme « No »
        box("C0012345678", 0, 226, 200, 30),
    ]
    parsed = parse_fields(boxes)
    assert parsed.birth_date.value == "2000-02-01"
    assert parsed.document_number.value == "C0012345678"


def test_value_on_the_same_line_as_its_label() -> None:
    boxes = [box("Nom :", 0, 0, 60, 24), box("BAMBA", 80, 2, 120, 24)]
    assert parse_fields(boxes).surname.value == "BAMBA"


def test_impossible_dates_are_rejected() -> None:
    boxes = [box("Né(e) le", 0, 0, 80, 22), box("31/02/1998", 0, 26, 150, 30)]
    assert parse_fields(boxes).birth_date.value is None


def test_unreadable_photo_gives_empty_fields() -> None:
    parsed = parse_fields([box("~~ reflet ~~", 0, 0)])
    assert parsed.holder_name.value is None
    assert parsed.document_number.value is None
    assert parsed.doc_type.value is None


def test_doc_type_detection_order() -> None:
    assert detect_doc_type([box("ATTESTATION D'IDENTITÉ", 0, 0)]).value == "attestation"
    assert detect_doc_type([box("CARTE D'ÉTUDIANT", 0, 0)]).value == "carte_etudiant"
    assert detect_doc_type([box("Certificat d'immatriculation", 0, 0)]).value == "carte_grise"


def test_only_values_are_sensitive() -> None:
    sensitive = {b.text for b in CNI_BOXES if is_sensitive(b)}
    assert {"KOUASSI", "AYA MARIE", "12/04/1998", "CI 0099 1234 56", "F"} <= sensitive
    assert "Nom" not in sensitive
    assert "CARTE NATIONALE D'IDENTITÉ" not in sensitive
