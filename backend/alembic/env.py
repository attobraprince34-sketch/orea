"""Environnement Alembic : branche les migrations sur les modèles d'Orea."""

from logging.config import fileConfig
from typing import Any

from alembic import context
from sqlalchemy import DateTime, engine_from_config, pool

from app.core.config import settings
from app.db.base import Base, UTCDateTime
from app.models import *  # noqa: F403  (charge tous les modèles dans les métadonnées)

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def render_item(type_: str, obj: Any, autogen_context: Any) -> str | bool:
    """Écrit notre type UTCDateTime comme un simple DateTime(timezone=True) dans les
    migrations, pour qu'elles ne dépendent pas du code applicatif."""
    if type_ == "type" and isinstance(obj, UTCDateTime):
        return f"sa.{DateTime(timezone=True)!r}"
    return False


def run_migrations_offline() -> None:
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_item=render_item,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_item=render_item,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
