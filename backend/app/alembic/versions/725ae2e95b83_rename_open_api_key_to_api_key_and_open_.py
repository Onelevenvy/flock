"""Rename open_api_key to api_key and open_api_base to base_url for better clarity and compatibility

Revision ID: 725ae2e95b83
Revises: ac5e8ae441b8
Create Date: 2024-12-23 18:43:25.188173

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '725ae2e95b83'
down_revision = 'ac5e8ae441b8'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('member', sa.Column('api_key', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('member', sa.Column('base_url', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.drop_column('member', 'openai_api_key')
    op.drop_column('member', 'openai_api_base')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('member', sa.Column('openai_api_base', sa.VARCHAR(), autoincrement=False, nullable=False))
    op.add_column('member', sa.Column('openai_api_key', sa.VARCHAR(), autoincrement=False, nullable=False))
    op.drop_column('member', 'base_url')
    op.drop_column('member', 'api_key')
    # ### end Alembic commands ###