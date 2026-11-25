"""QR codes de retrait.

Un QR code contient « OREA1.<jeton> ». Le jeton est dérivé :

    jeton = base64url( HMAC-SHA256(QR_SECRET, "<id du code>:<nonce aléatoire>") )

- unique : le nonce est aléatoire (128 bits) et l'id est un UUID ;
- régénérable : le propriétaire peut réafficher son QR à tout moment ;
- infalsifiable : sans QR_SECRET, impossible de fabriquer un jeton valide, même avec
  une copie de la base (qui ne contient que des empreintes SHA-256).

Un code de secours court (XXXX-XXXX-XXXX) est dérivé du même jeton, pour le cas où
la caméra du point relais ne fonctionne pas.
"""

import base64
import hashlib
import hmac
import io
import re
import secrets
import uuid

import qrcode
from qrcode.constants import ERROR_CORRECT_M

from app.core.config import settings
from app.core.security import sha256_hex

PAYLOAD_PREFIX = "OREA1."
# Alphabet sans caractères ambigus (pas de 0/O, 1/I/L) : plus facile à dicter.
_SHORT_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
_SHORT_CODE_RE = re.compile(r"^[2-9A-HJKMNP-Z]{12}$")

# Couleurs de la charte : Encre sur blanc (contraste maximal pour les scanners).
_QR_FILL = "#0E1A16"
_QR_BACK = "#FFFFFF"


def new_nonce() -> str:
    return secrets.token_hex(16)


def derive_token(code_id: uuid.UUID, nonce: str) -> str:
    digest = hmac.new(
        settings.QR_SECRET.encode(), f"{code_id}:{nonce}".encode(), hashlib.sha256
    ).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def short_code_from_token(token: str) -> str:
    """12 caractères (≈ 59 bits) tirés du jeton, groupés par 4 : « 7KQM-X2PA-9TRD »."""
    number = int.from_bytes(hashlib.sha256(f"short:{token}".encode()).digest()[:8], "big")
    chars = []
    for _ in range(12):
        number, index = divmod(number, len(_SHORT_ALPHABET))
        chars.append(_SHORT_ALPHABET[index])
    raw = "".join(chars)
    return f"{raw[:4]}-{raw[4:8]}-{raw[8:]}"


def payload_from_token(token: str) -> str:
    return f"{PAYLOAD_PREFIX}{token}"


def token_hash(token: str) -> str:
    return sha256_hex(token)


def short_code_hash(short_code: str) -> str:
    return sha256_hex(normalize_short_code(short_code))


def normalize_short_code(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def lookup_hashes(raw_input: str) -> tuple[str, str] | None:
    """Analyse ce que l'agent a scanné ou saisi.

    Renvoie ("token", empreinte) ou ("short", empreinte), ou None si le format est
    méconnaissable.
    """
    value = raw_input.strip()
    if value.startswith(PAYLOAD_PREFIX) and len(value) > len(PAYLOAD_PREFIX) + 20:
        return "token", token_hash(value.removeprefix(PAYLOAD_PREFIX))
    normalized = normalize_short_code(value)
    if _SHORT_CODE_RE.match(normalized):
        return "short", sha256_hex(normalized)
    return None


def make_png(payload: str, box_size: int = 10) -> bytes:
    """Image PNG du QR code (correction d'erreur M : lisible même sur un écran rayé)."""
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=box_size, border=3)
    qr.add_data(payload)
    qr.make(fit=True)
    image = qr.make_image(fill_color=_QR_FILL, back_color=_QR_BACK)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
