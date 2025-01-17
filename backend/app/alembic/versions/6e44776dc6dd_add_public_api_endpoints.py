"""add public api endpoints

Revision ID: 6e44776dc6dd
Revises: 4d6839c8481b
Create Date: 2024-10-22 08:39:03.993662

"""

import sqlalchemy as sa
import sqlmodel.sql.sqltypes

from alembic import op

# revision identifiers, used by Alembic.
revision = "6e44776dc6dd"
down_revision = "4d6839c8481b"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "apikey",
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("hashed_key", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("short_key", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["team.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table("apikey")
    # ### end Alembic commands ###
