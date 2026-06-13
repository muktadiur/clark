from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "sqlite:///./clark.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
    _migrate()


def _add_missing_columns(conn, table: str, columns: dict):
    existing = {col["name"] for col in inspect(engine).get_columns(table)}
    for name, col_type in columns.items():
        if name not in existing:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {col_type}"))


def _migrate():
    """Additive, idempotent column migration for SQLite (no Alembic in use)."""
    with engine.begin() as conn:
        _add_missing_columns(
            conn,
            "user_settings",
            {"base_url": "VARCHAR", "chat_models": "VARCHAR", "default_model": "VARCHAR"},
        )
        _add_missing_columns(
            conn, "users", {"display_name": "VARCHAR", "username": "VARCHAR"}
        )
        # NULL usernames stay distinct in SQLite, so this index is safe pre-population.
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username "
                "ON users (username)"
            )
        )
