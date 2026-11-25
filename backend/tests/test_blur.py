"""Tests du floutage OpenCV."""

import cv2
import numpy as np
import pytest

from app.core.errors import BadRequest
from app.services import blur_service


def sharpness(image: np.ndarray) -> float:
    """Variance du laplacien : élevée pour une zone nette, faible pour une zone floue."""
    return float(cv2.Laplacian(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())


@pytest.fixture
def textured() -> np.ndarray:
    rng = np.random.default_rng(42)
    image = rng.integers(0, 255, (400, 600, 3), dtype=np.uint8)
    cv2.putText(image, "CI 0099 1234 56", (40, 220), cv2.FONT_HERSHEY_SIMPLEX, 1.4,
                (0, 0, 0), 3)
    return image


def test_blur_destroys_the_region_only(textured: np.ndarray) -> None:
    box = (30, 180, 420, 240)
    output = blur_service.blur_regions(textured, [box], pad_ratio=0)
    x0, y0, x1, y1 = box

    assert sharpness(output[y0:y1, x0:x1]) < sharpness(textured[y0:y1, x0:x1]) / 20
    # Hors de la zone, l'image est intacte, et l'original n'est pas modifié.
    assert np.array_equal(output[300:, :], textured[300:, :])
    assert not np.array_equal(output, textured)


def test_boxes_outside_the_image_are_ignored(textured: np.ndarray) -> None:
    output = blur_service.blur_regions(textured, [(-50, -50, -10, -10), (900, 900, 950, 950)])
    assert np.array_equal(output, textured)


def test_decode_rejects_non_images() -> None:
    with pytest.raises(BadRequest) as error:
        blur_service.decode_image(b"ceci n'est pas une image")
    assert error.value.code == "IMAGE_UNREADABLE"


def test_decode_rejects_tiny_images() -> None:
    ok, png = cv2.imencode(".png", np.zeros((80, 120, 3), dtype=np.uint8))
    assert ok
    with pytest.raises(BadRequest) as error:
        blur_service.decode_image(png.tobytes())
    assert error.value.code == "IMAGE_TOO_SMALL"


def test_large_images_are_downscaled(textured: np.ndarray) -> None:
    big = cv2.resize(textured, (4000, 2600))
    ok, jpeg = cv2.imencode(".jpg", big)
    assert ok
    decoded = blur_service.decode_image(jpeg.tobytes())
    assert max(decoded.shape[:2]) == blur_service.MAX_OCR_SIDE


def test_stored_jpeg_has_no_metadata(textured: np.ndarray) -> None:
    jpeg = blur_service.encode_jpeg(textured)
    assert jpeg[:2] == b"\xff\xd8"
    assert b"Exif" not in jpeg[:200] and b"GPS" not in jpeg


def test_no_face_on_a_blank_card() -> None:
    assert blur_service.detect_faces(np.full((400, 600, 3), 230, dtype=np.uint8)) == []
