"""Configuration centrale d'Orea.

Toutes les valeurs sont lues depuis les variables d'environnement (ou le fichier .env).
Les valeurs par défaut conviennent au développement local ; les secrets DOIVENT être
changés en production (voir .env.example).
"""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Application ---------------------------------------------------------------
    APP_NAME: str = "Orea API"
    ENVIRONMENT: str = "development"  # development | test | production
    API_PREFIX: str = "/api/v1"
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # --- Base de données -----------------------------------------------------------
    DATABASE_URL: str = "postgresql+psycopg://orea:orea@localhost:5433/orea"

    # --- Authentification ----------------------------------------------------------
    JWT_SECRET: str = "dev-only-change-me-jwt-secret-please-32b"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 15
    REFRESH_TOKEN_DAYS: int = 7
    REFRESH_COOKIE_NAME: str = "orea_refresh"
    COOKIE_SECURE: bool = False  # True en production (HTTPS obligatoire)

    # --- Secrets métier ------------------------------------------------------------
    # Clé secrète (« sel secret ») utilisée pour hacher les numéros de pièce.
    DOC_NUMBER_PEPPER: str = "dev-only-change-me-doc-number-pepper"
    # Clé secrète utilisée pour dériver les jetons des QR codes.
    QR_SECRET: str = "dev-only-change-me-qr-secret"

    # --- Règles métier -------------------------------------------------------------
    MATCH_THRESHOLD: int = Field(default=85, ge=50, le=100)
    SEARCH_THRESHOLD: int = Field(default=75, ge=40, le=100)
    PICKUP_CODE_DAYS: int = 14
    DECLARATION_EXPIRY_DAYS: int = 90
    CLAIM_MAX_ATTEMPTS: int = 5
    CLAIM_LOCK_HOURS: int = 24

    # --- Limitation du nombre de requêtes -------------------------------------------
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_SEARCH: str = "30/minute"
    RATE_LIMIT_VERIFY: str = "5 per 15 minutes"
    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_OCR: str = "10/minute"

    # --- Tâches planifiées -----------------------------------------------------------
    SCHEDULER_ENABLED: bool = True
    SCHEDULER_INTERVAL_SECONDS: int = 3600

    # --- Fichiers ------------------------------------------------------------------
    MEDIA_DIR: str = "./media"
    PENDING_UPLOAD_TTL_MINUTES: int = 60

    # --- OCR ------------------------------------------------------------------------
    OCR_ENABLED: bool = True
    OCR_LANGUAGES: list[str] = Field(default_factory=lambda: ["fr", "en"])
    OCR_MODEL_DIR: str | None = None  # défaut EasyOCR : ~/.EasyOCR/model
    OCR_DOWNLOAD_MODELS: bool = True  # False en Docker : modèles inclus dans l'image
    OCR_PRELOAD: bool = True  # charge le modèle au démarrage (premier scan rapide)
    OCR_MAX_UPLOAD_MB: int = 8
    OCR_REVIEW_THRESHOLD: float = 0.75  # sous ce seuil, le champ est signalé « à vérifier »

    # --- E-mail ---------------------------------------------------------------
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str = "Orea <bonjour@orea.ci>"
    SMTP_STARTTLS: bool = False
    # « smtp » (Mailpit, vrai serveur) ou « file » (mode local : fichiers HTML).
    EMAIL_BACKEND: str = "smtp"
    OUTBOX_DIR: str = "./outbox"
    SMTP_TIMEOUT_SECONDS: int = 10
    EMAIL_ENABLED: bool = True

    @field_validator("CORS_ORIGINS", "OCR_LANGUAGES", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accepte « a,b,c » en plus du format JSON dans le .env."""
        if isinstance(value, str) and not value.strip().startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
