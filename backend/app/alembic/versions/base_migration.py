"""base migration

Revision ID: base_migration
Revises: 
Create Date: 2024-03-21 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "base_migration"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
