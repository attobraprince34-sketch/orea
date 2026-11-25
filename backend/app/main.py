"""Point d'entrée de l'API Orea.

Lancement local :  uvicorn app.main:app --reload
Documentation   :  http://localhost:8000/docs (Swagger) · /redoc
"""

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.middleware import SlowAPIMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.rate_limit import limiter
from app.services import expiry_service, ocr_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s · %(message)s")

DESCRIPTION = """
**Orea** aide les habitants d'Abidjan à retrouver leurs pièces perdues.

* **J'ai trouvé** : je photographie la pièce, je la dépose dans un point relais.
* **J'ai perdu** : je déclare ma perte et je suis prévenu dès qu'elle est retrouvée.
* **Je récupère** : je prouve que la pièce est à moi, je reçois un QR code à usage unique.

Pour tester les routes protégées : bouton **Authorize**, puis un compte de démonstration.
Toutes les erreurs ont le format `{ "code": "...", "message": "..." }`.
"""


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    task = None
    if settings.SCHEDULER_ENABLED:
        task = asyncio.create_task(expiry_service.scheduler_loop())
    if settings.OCR_PRELOAD and settings.OCR_ENABLED:
        # En tâche de fond : l'API répond tout de suite pendant le chargement du modèle.
        asyncio.get_running_loop().run_in_executor(None, ocr_service.warm_up)
    yield
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description=DESCRIPTION,
        version="1.0.0",
        lifespan=lifespan,
        openapi_url=f"{settings.API_PREFIX}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        swagger_ui_parameters={"persistAuthorization": True, "displayRequestDuration": True},
    )

    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,  # nécessaire pour le cookie du refresh token
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.API_PREFIX)

    @app.get("/health", tags=["Système"], summary="Sonde de santé")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
