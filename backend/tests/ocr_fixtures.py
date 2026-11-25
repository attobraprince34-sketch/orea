"""Boîtes OCR simulées, calquées sur la disposition des spécimens.

Elles permettent de tester l'analyse des champs et le floutage sans charger le
vrai modèle EasyOCR (plusieurs centaines de Mo, quelques secondes de chargement).
"""

import numpy as np

from app.services.ocr_service import TextBox


def box(text: str, x: float, y: float, w: float = 200, h: float = 30,
        conf: float = 0.95) -> TextBox:
    return TextBox(text, conf, x, y, x + w, y + h)


CNI_BOXES = [
    box("DOCUMENT FICTIF · PROJET ÉDUCATIF OREA", 84, 42, 450, 20),
    box("CARTE NATIONALE D'IDENTITÉ", 84, 66, 550, 36),
    box("Nom", 330, 140, 50, 22),
    box("KOUASSI", 330, 168, 155, 34),
    box("Prénoms", 330, 225, 90, 22),
    box("AYA MARIE", 330, 253, 185, 34),
    box("Né(e) le", 330, 310, 80, 22),
    box("12/04/1998", 330, 338, 170, 34, conf=0.62),
    box("Sexe", 640, 310, 50, 22),
    box("F", 640, 338, 20, 34),
    box("N° de la carte", 330, 395, 140, 22),
    box("CI 0099 1234 56", 330, 423, 250, 34),
    box("SPÉCIMEN", 120, 300, 700, 160, conf=0.4),
]

PERMIS_BOXES = [
    box("PERMIS DE CONDUIRE", 84, 66, 400, 36),
    box("1. Nom", 330, 140, 70, 22),
    box("KONAN", 330, 168, 120, 34),
    box("2. Prénoms", 330, 225, 110, 22),
    box("YAO FABRICE", 330, 253, 210, 34),
    box("3. Date de naissance", 330, 310, 200, 22),
    box("03/09/1990", 330, 338, 170, 34),
    box("5. N° du permis", 330, 395, 150, 22),
    box("AB 4521 7788", 330, 423, 210, 34),
]

# Passeport mal lu : libellés de noms illisibles, seule la MRZ est exploitable.
PASSPORT_BOXES = [
    box("PASSEPORT", 84, 66, 200, 36),
    box("Date de naissance / Date of birth", 310, 280, 320, 22),
    box("21/07/1995", 310, 308, 170, 34),
    box("N° du passeport / Passport No", 660, 280, 300, 22),
    box("20AB12345", 660, 308, 170, 34),
    box("P<XXXTRAORE<<AWA<<<<<<<<<<<<<<<<<<<<<<<<<<<<", 36, 462, 900, 34, conf=0.8),
    box("20AB123450XXX9507216F3001019<<<<<<<<<<<<<<02", 36, 512, 900, 34, conf=0.8),
]


class FakeEngine:
    """Moteur OCR factice : renvoie toujours les mêmes boîtes."""

    def __init__(self, boxes: list[TextBox]) -> None:
        self.boxes = boxes
        self.calls = 0

    def read(self, image: np.ndarray) -> list[TextBox]:
        self.calls += 1
        return self.boxes
