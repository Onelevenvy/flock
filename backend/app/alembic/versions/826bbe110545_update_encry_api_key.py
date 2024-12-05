"""update encry api key

Revision ID: 826bbe110545
Revises: 92f07171e6e3
Create Date: 2024-12-05 11:31:36.057595

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from app.core.security import security_manager

# revision identifiers, used by Alembic.
revision = '826bbe110545'
down_revision = '92f07171e6e3'
branch_labels = None
depends_on = None


def upgrade():
    # 获取所有现有的API密钥
    connection = op.get_bind()
    results = connection.execute(
        text('SELECT id, api_key FROM modelprovider WHERE api_key IS NOT NULL')
    ).fetchall()
    
    # 加密现有的API密钥
    for id, api_key in results:
        if api_key:
            encrypted_key = security_manager.encrypt_api_key(api_key)
            connection.execute(
                text('UPDATE modelprovider SET api_key = :key WHERE id = :id'),
                {"key": encrypted_key, "id": id}
            )


def downgrade():
    # 获取所有加密的API密钥
    connection = op.get_bind()
    results = connection.execute(
        text('SELECT id, api_key FROM modelprovider WHERE api_key IS NOT NULL')
    ).fetchall()
    
    # 解密API密钥
    for id, encrypted_key in results:
        if encrypted_key:
            decrypted_key = security_manager.decrypt_api_key(encrypted_key)
            connection.execute(
                text('UPDATE modelprovider SET api_key = :key WHERE id = :id'),
                {"key": decrypted_key, "id": id}
            ) 