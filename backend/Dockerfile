# Image de l'API Orea (avec lecture automatique des pièces).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # Modèles OCR inclus dans l'image : aucun téléchargement pendant la démo.
    OCR_MODEL_DIR=/opt/easyocr \
    OCR_DOWNLOAD_MODELS=false

# Bibliothèques système utilisées par OpenCV et PyTorch.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) PyTorch version CPU (≈ 200 Mo au lieu de plusieurs Go pour la version GPU).
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision

# 2) Dépendances du projet : couche réutilisée tant que pyproject.toml ne change pas.
COPY pyproject.toml ./
RUN mkdir app && touch app/__init__.py && pip install ".[ocr]" && rm -rf app

# 3) Téléchargement des modèles EasyOCR (français + anglais) au moment du build.
RUN python -c "import easyocr; easyocr.Reader(['fr', 'en'], gpu=False, model_storage_directory='/opt/easyocr', verbose=False)" \
    && chmod -R a+rX /opt/easyocr

# 4) Code de l'application.
COPY . .
RUN pip install --no-deps . \
    && useradd --create-home --uid 1000 orea \
    && mkdir -p /data/media && chown -R orea /data/media
USER orea

EXPOSE 8000

# Applique les migrations puis démarre l'API.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers"]
