"""Configuration des tests.

Les tests tournent sur une base SQLite en mémoire, recréée pour chaque test :
aucun serveur PostgreSQL n'est nécessaire pour lancer `pytest`.
"""

import os
import tempfile

# Doit être défini AVANT d'importer l'application.
os.environ.update(
    {
        "ENVIRONMENT": "test",
        "DATABASE_URL": "sqlite://",
        "SCHEDULER_ENABLED": "false",
        "EMAIL_ENABLED": "false",
        "MATCH_THRESHOLD": "85",
        "OCR_PRELOAD": "false",
        "EMAIL_BACKEND": "smtp",
        "MEDIA_DIR": tempfile.mkdtemp(prefix="orea-media-"),
    }
)

from collections.abc import Iterator  # noqa: E402
from datetime import date  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.rate_limit import limiter  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import RelayPoint, User  # noqa: E402
from app.models.enums import Commune, Role  # noqa: E402
from app.services import stats_service  # noqa: E402

engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

# Le hachage bcrypt est volontairement lent : on le calcule une seule fois.
PASSWORD = "MotDePasse123"
PASSWORD_HASH = hash_password(PASSWORD)

# Numéro fictif utilisé dans les scénarios (jamais un vrai numéro).
CNI_NUMBER = "CI 0099 1234 56"


@pytest.fixture(autouse=True)
def _fresh_database() -> Iterator[None]:
    Base.metadata.create_all(engine)
    limiter.reset()
    stats_service.clear_cache()
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db() -> Iterator[Session]:
    with TestingSession() as session:
        yield session


@pytest.fixture
def client() -> Iterator[TestClient]:
    def _override() -> Iterator[Session]:
        with TestingSession() as session:
            yield session

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ------------------------------------------------------------------------------
# Fabriques de données
# ------------------------------------------------------------------------------
def make_relay(db: Session, name: str = "Mairie de Cocody",
               commune: Commune = Commune.COCODY) -> RelayPoint:
    relay = RelayPoint(name=name, commune=commune, address="Boulevard Latrille",
                       latitude=5.36, longitude=-3.99)
    db.add(relay)
    db.commit()
    return relay


def make_user(db: Session, email: str, role: Role = Role.USER,
              relay: RelayPoint | None = None, name: str | None = None) -> User:
    user = User(email=email, password_hash=PASSWORD_HASH, full_name=name or email.split("@")[0],
                role=role, relay_point_id=relay.id if relay else None, phone="+225 07 00 00 00")
    db.add(user)
    db.commit()
    return user


def auth(user: User) -> dict[str, str]:
    token, _ = create_access_token(user.id, user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def relay(db: Session) -> RelayPoint:
    return make_relay(db)


@pytest.fixture
def finder(db: Session) -> User:
    return make_user(db, "trouveur@orea.ci", name="Koffi Trouveur")


@pytest.fixture
def owner(db: Session) -> User:
    return make_user(db, "proprio@orea.ci", name="Aya Kouassi")


@pytest.fixture
def agent(db: Session, relay: RelayPoint) -> User:
    return make_user(db, "agent@orea.ci", Role.RELAY, relay, name="Agent Cocody")


@pytest.fixture
def admin(db: Session) -> User:
    return make_user(db, "admin@orea.ci", Role.ADMIN, name="Admin Orea")


def found_payload(relay: RelayPoint, **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "doc_type": "cni",
        "holder_name": "KOUASSI Aya Marie",
        "birth_date": "1998-04-12",
        "document_number": CNI_NUMBER,
        "commune_found": "cocody",
        "found_on": date.today().isoformat(),
        "relay_point_id": str(relay.id),
    }
    payload.update(overrides)
    return payload


def lost_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "doc_type": "cni",
        "holder_name": "Aya Marie Kouassi",
        "birth_date": "1998-04-12",
        "commune_lost": "cocody",
    }
    payload.update(overrides)
    return payload
