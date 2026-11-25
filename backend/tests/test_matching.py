"""Tests du moteur de correspondance (sans base de données)."""

from datetime import date

import pytest

from app.core.security import hash_doc_number
from app.models.enums import DocType
from app.services.matching_service import Candidate, compute_score
from app.utils.text import initials, normalize_name

THRESHOLD = 85


def cand(name: str, doc_type: DocType = DocType.CNI, birth: date | None = None,
         number: str | None = None) -> Candidate:
    return Candidate(
        doc_type=doc_type,
        name_norm=normalize_name(name),
        birth_date=birth,
        number_hash=hash_doc_number(number) if number else None,
    )


# --- Normalisation --------------------------------------------------------------
@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("KOUASSI Aya Marie", "kouassi aya marie"),
        ("  Kouamé   Aïcha ", "kouame aicha"),
        ("N'GUESSAN-Konan Éric", "n guessan konan eric"),
        ("Bamba\tSéverine", "bamba severine"),
    ],
)
def test_normalize_name(raw: str, expected: str) -> None:
    assert normalize_name(raw) == expected


def test_initials_expose_only_first_letters() -> None:
    assert initials("Kouassi Aya Marie") == "K. A. M."
    assert initials("Éric N'Guessan Konan Yao") == "E. N. G."  # 3 initiales maximum


# --- Score ----------------------------------------------------------------------
def test_identical_names_score_100() -> None:
    assert compute_score(cand("Kouassi Aya"), cand("Kouassi Aya")) == 100


def test_inverted_first_and_last_names_match() -> None:
    score = compute_score(cand("KOUASSI Aya Marie"), cand("Aya Marie Kouassi"))
    assert score == 100


def test_accents_and_case_are_ignored() -> None:
    assert compute_score(cand("KOUAMÉ Aïcha"), cand("kouame aicha")) == 100


def test_small_misspelling_still_matches() -> None:
    score = compute_score(cand("Kouassi Aya Marie"), cand("Kouasi Aya Mari"))
    assert score is not None and score >= THRESHOLD


def test_misspelled_and_inverted_still_matches() -> None:
    score = compute_score(cand("Konan Yao Fabrice"), cand("Fabrice Konan Yau"))
    assert score is not None and score >= THRESHOLD


def test_different_people_do_not_match() -> None:
    score = compute_score(cand("Kouassi Aya Marie"), cand("Traoré Ibrahim"))
    assert score is not None and score < THRESHOLD


def test_shared_family_name_is_not_enough() -> None:
    score = compute_score(cand("Kouassi Aya Marie"), cand("Kouassi Jean Baptiste"))
    assert score is not None and score < THRESHOLD


def test_different_doc_types_never_match() -> None:
    assert compute_score(cand("Kouassi Aya"), cand("Kouassi Aya", DocType.PASSEPORT)) is None


def test_same_number_is_a_certain_match_despite_name_typos() -> None:
    a = cand("Kouassi Aya", number="CI0099123456")
    b = cand("Kwasi Aïa", number="ci 0099 1234 56")
    assert compute_score(a, b) == 100


def test_different_numbers_mean_different_documents() -> None:
    a = cand("Kouassi Aya", number="CI0099123456")
    b = cand("Kouassi Aya", number="CI0000000001")
    assert compute_score(a, b) is None


def test_different_birth_dates_rule_out_a_homonym() -> None:
    a = cand("Kouassi Aya", birth=date(1998, 4, 12))
    b = cand("Kouassi Aya", birth=date(2001, 1, 3))
    assert compute_score(a, b) is None


def test_same_birth_date_gives_a_bonus() -> None:
    without = compute_score(cand("Kouassi Aya Mari"), cand("Kouassi Aya Marie"))
    with_bonus = compute_score(
        cand("Kouassi Aya Mari", birth=date(1998, 4, 12)),
        cand("Kouassi Aya Marie", birth=date(1998, 4, 12)),
    )
    assert without is not None and with_bonus is not None
    assert with_bonus == min(100, without + 5)
