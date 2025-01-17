"""add subgraph table

Revision ID: add_subgraph_table
Revises: base_migration
Create Date: 2024-03-21 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "add_subgraph_table"
down_revision = "base_migration"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "subgraph",
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("subgraph")
