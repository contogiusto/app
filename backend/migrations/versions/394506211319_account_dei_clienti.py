"""account dei clienti

Revision ID: 394506211319
Revises: 4def7c1ba6d1
Create Date: 2026-10-20 12:24:25.580353
"""

import sqlalchemy as sa
from alembic import op

revision = "394506211319"
down_revision = "4def7c1ba6d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("privacy_accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.add_column("payment", sa.Column("customer_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_payment_customer_id"), "payment", ["customer_id"], unique=False)
    op.create_foreign_key(
        "payment_customer_id_fkey",
        "payment",
        "customer",
        ["customer_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("payment_customer_id_fkey", "payment", type_="foreignkey")
    op.drop_index(op.f("ix_payment_customer_id"), table_name="payment")
    op.drop_column("payment", "customer_id")
    op.drop_table("customer")
