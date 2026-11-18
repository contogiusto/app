"""utenti staff: password_changed_at (revoca dei token al cambio password)

Colonna nullable: compatibile con la versione di codice precedente (ADR 0002).

Revision ID: 5b1d0f2a7c34
Revises: 1c92864381ed
Create Date: 2026-11-18 22:30:00
"""

import sqlalchemy as sa
from alembic import op

revision = "5b1d0f2a7c34"
down_revision = "1c92864381ed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "app_user", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("app_user", "password_changed_at")
