"""Normalisation des noms, utilisée par la correspondance et la recherche."""

import re
import unicodedata

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_SPACES = re.compile(r"\s+")


def strip_accents(value: str) -> str:
    """« Kouamé Aïcha » → « Kouame Aicha »."""
    decomposed = unicodedata.normalize("NFKD", value)
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def normalize_name(value: str) -> str:
    """Forme canonique d'un nom pour la comparaison floue.

    minuscules → sans accents → ponctuation et tirets remplacés par des espaces
    → espaces multiples réduits.

    « KOUASSI-Aya  Marie » → « kouassi aya marie »
    """
    lowered = strip_accents(value).lower()
    return _SPACES.sub(" ", _NON_ALNUM.sub(" ", lowered)).strip()


def clean_display_name(value: str) -> str:
    """Nettoie un nom saisi pour l'affichage (espaces superflus), sans le dénaturer."""
    return _SPACES.sub(" ", value).strip()


def initials(value: str, limit: int = 3) -> str:
    """Initiales publiques d'un nom : « Kouassi Aya Marie » → « K. A. M. ».

    Ce sont les SEULES informations nominatives exposées par la recherche publique.
    """
    words = [w for w in normalize_name(value).split(" ") if w]
    return " ".join(f"{w[0].upper()}." for w in words[:limit])


def upper_first(value: str) -> str:
    """Majuscule initiale SANS toucher au reste : « ta CNI » → « Ta CNI »
    (str.capitalize donnerait « Ta cni »)."""
    return value[:1].upper() + value[1:]
