"""contatori del rate limit

Revision ID: 4def7c1ba6d1
Revises: 81ce131da282
Create Date: 2026-10-20 09:23:32.027198
"""

import sqlalchemy as sa
from alembic import op

revision = "4def7c1ba6d1"
down_revision = "81ce131da282"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Solo una tabella nuova: il codice precedente la ignora (ADR 0002).
    op.create_table(
        "rate_limit_counter",
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("key", "window_start"),
    )
    op.create_index(
        "ix_rate_limit_counter_expires_at", "rate_limit_counter", ["expires_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_rate_limit_counter_expires_at", table_name="rate_limit_counter")
    op.drop_table("rate_limit_counter")
