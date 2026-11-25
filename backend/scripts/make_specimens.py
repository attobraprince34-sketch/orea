"""Génère 3 FAUSSES pièces d'identité marquées « SPÉCIMEN » pour tester l'OCR.

    python -m scripts.make_specimens

Garde-fous :
- toutes les données sont fictives (noms courants, numéros inventés) ;
- aucun emblème, drapeau ni mise en page officielle n'est reproduit ;
- chaque image porte un grand filigrane « SPÉCIMEN » et la mention
  « Document fictif · sans valeur ».

Les images produites sont versionnées dans backend/specimens/.
"""

import math
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT_DIR = Path(__file__).resolve().parent.parent / "specimens"

# Palette Orea
EMERALD = (15, 92, 71)
ORANGE = (240, 138, 36)
INK = (14, 26, 22)
MINT = (234, 243, 239)
MUTED = (88, 110, 102)
WATERMARK = (217, 59, 59, 70)

W, H = 1012, 638  # format carte bancaire (ID-1), environ 300 ppp


# ------------------------------------------------------------------------------
# Polices : on cherche des polices courantes, sinon la police intégrée de Pillow.
# ------------------------------------------------------------------------------
_CANDIDATES = {
    "regular": ["arial.ttf", "Arial.ttf", "DejaVuSans.ttf", "LiberationSans-Regular.ttf"],
    "bold": ["arialbd.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf"],
    "mono": ["consola.ttf", "DejaVuSansMono.ttf", "LiberationMono-Regular.ttf", "cour.ttf"],
}
_FONT_DIRS = [
    Path("C:/Windows/Fonts"),
    Path("/usr/share/fonts/truetype/dejavu"),
    Path("/usr/share/fonts/truetype/liberation"),
    Path("/Library/Fonts"),
    Path("/System/Library/Fonts/Supplemental"),
]


def font(kind: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in _CANDIDATES[kind]:
        for directory in _FONT_DIRS:
            path = directory / name
            if path.exists():
                return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size=size)


# ------------------------------------------------------------------------------
# Éléments graphiques
# ------------------------------------------------------------------------------
def guilloche(draw: ImageDraw.ImageDraw, color: tuple[int, int, int]) -> None:
    """Fines ondulations décoratives en fond (purement esthétiques)."""
    for k in range(14):
        points = [
            (x, 330 + 220 * math.sin(x / 90 + k * 0.45) * math.cos(x / 260 + k * 0.2))
            for x in range(0, W + 8, 8)
        ]
        draw.line(points, fill=color, width=1)


def portrait(img: Image.Image, box: tuple[int, int, int, int]) -> None:
    """Silhouette stylisée à la place d'une photo (jamais de vrai visage)."""
    draw = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=18, fill=(205, 219, 212), outline=EMERALD, width=3)
    cx, w = (x0 + x1) // 2, x1 - x0
    draw.ellipse((cx - w * 0.2, y0 + 45, cx + w * 0.2, y0 + 45 + w * 0.4), fill=(150, 170, 162))
    draw.pieslice((cx - w * 0.38, y1 - w * 0.48, cx + w * 0.38, y1 + w * 0.3), 180, 360,
                  fill=(150, 170, 162))


def pin_mark(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 34) -> None:
    """Petite épingle Orea : signale clairement un document de démonstration."""
    r = size // 2
    draw.ellipse((x - r, y - r, x + r, y + r), fill=EMERALD)
    draw.polygon([(x - r * 0.72, y + r * 0.6), (x + r * 0.72, y + r * 0.6), (x, y + r * 1.7)],
                 fill=EMERALD)
    draw.ellipse((x - r * 0.5, y - r * 0.5, x + r * 0.5, y + r * 0.5), fill="white")
    draw.ellipse((x - r * 0.24, y - r * 0.24, x + r * 0.24, y + r * 0.24), fill=ORANGE)


def watermark(img: Image.Image) -> Image.Image:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    text_layer = Image.new("RGBA", (W * 2, 260), (0, 0, 0, 0))
    ImageDraw.Draw(text_layer).text((W // 2, 20), "SPÉCIMEN", font=font("bold", 190),
                                    fill=WATERMARK)
    rotated = text_layer.rotate(18, expand=True)
    layer.alpha_composite(rotated, (-W // 2 + 40, H // 2 - rotated.height // 2 + 40))
    return Image.alpha_composite(img.convert("RGBA"), layer)


@dataclass
class Field:
    label: str
    value: str
    x: int
    y: int


def base_card(title: str, accent: tuple[int, int, int]) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (W, H), MINT)
    draw = ImageDraw.Draw(img)
    guilloche(draw, (214, 228, 221))
    draw.rounded_rectangle((6, 6, W - 6, H - 6), radius=34, outline=accent, width=6)
    draw.rectangle((6, 34, W - 6, 112), fill=accent)
    pin_mark(draw, 50, 60)
    draw.text((84, 42), "DOCUMENT FICTIF · PROJET ÉDUCATIF OREA", font=font("regular", 20),
              fill=(220, 236, 229))
    draw.text((84, 66), title, font=font("bold", 36), fill="white")
    draw.text((40, H - 46), "SPÉCIMEN · Document fictif · sans valeur · ne pas utiliser",
              font=font("regular", 20), fill=MUTED)
    return img, draw


def draw_fields(draw: ImageDraw.ImageDraw, fields: list[Field]) -> None:
    for field in fields:
        draw.text((field.x, field.y), field.label, font=font("regular", 22), fill=MUTED)
        draw.text((field.x, field.y + 28), field.value, font=font("bold", 34), fill=INK)


def finish(img: Image.Image, name: str) -> Path:
    """Filigrane + léger flou et bruit de compression : plus proche d'une vraie photo."""
    final = watermark(img).convert("RGB").filter(ImageFilter.GaussianBlur(0.6))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    final.save(path, "JPEG", quality=88)
    return path


# ------------------------------------------------------------------------------
# Les trois spécimens
# ------------------------------------------------------------------------------
def cni() -> Path:
    img, draw = base_card("CARTE NATIONALE D'IDENTITÉ", EMERALD)
    portrait(img, (40, 150, 290, 470))
    draw_fields(draw, [
        Field("Nom", "KOUASSI", 330, 140),
        Field("Prénoms", "AYA MARIE", 330, 225),
        Field("Né(e) le", "12/04/1998", 330, 310),
        Field("Sexe", "F", 640, 310),
        Field("N° de la carte", "CI 0099 1234 56", 330, 395),
    ])
    return finish(img, "specimen_cni.jpg")


def permis() -> Path:
    img, draw = base_card("PERMIS DE CONDUIRE", (31, 107, 140))
    portrait(img, (40, 150, 290, 470))
    draw_fields(draw, [
        Field("1. Nom", "KONAN", 330, 140),
        Field("2. Prénoms", "YAO FABRICE", 330, 225),
        Field("3. Date de naissance", "03/09/1990", 330, 310),
        Field("9. Catégories", "B", 700, 310),
        Field("5. N° du permis", "AB 4521 7788", 330, 395),
    ])
    return finish(img, "specimen_permis.jpg")


def passeport() -> Path:
    img, draw = base_card("PASSEPORT", (120, 46, 52))
    portrait(img, (40, 140, 270, 420))
    draw_fields(draw, [
        Field("Nom / Surname", "TRAORÉ", 310, 130),
        Field("Prénoms / Given names", "AWA", 310, 205),
        Field("Date de naissance / Date of birth", "21/07/1995", 310, 280),
        Field("N° du passeport / Passport No", "20AB12345", 660, 280),
    ])
    # Bande de lecture automatique (MRZ) fictive.
    mono = font("mono", 30)
    draw.rectangle((20, 448, W - 20, 580), fill=(246, 246, 240))
    draw.text((36, 462), "P<XXXTRAORE<<AWA<<<<<<<<<<<<<<<<<<<<<<<<<<<<", font=mono, fill=INK)
    draw.text((36, 512), "20AB123450XXX9507216F3001019<<<<<<<<<<<<<<02", font=mono, fill=INK)
    return finish(img, "specimen_passeport.jpg")


if __name__ == "__main__":
    for generator in (cni, permis, passeport):
        print("Créé :", generator().relative_to(OUT_DIR.parent))
