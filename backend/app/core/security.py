import secrets
from datetime import datetime, timedelta
from typing import Any

import jwt
from cryptography.fernet import Fernet
from passlib.context import CryptContext

from app.core.config import settings


class SecurityManager:
    def __init__(self):
        # 密码加密上下文
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        # JWT算法
        self.jwt_algorithm = "HS256"
        # Fernet加密实例
        self._key = (
            settings.MODEL_PROVIDER_ENCRYPTION_KEY.encode()
            if settings.MODEL_PROVIDER_ENCRYPTION_KEY
            else Fernet.generate_key()
        )
        self._fernet = Fernet(self._key)

    def create_access_token(self, subject: str | Any, expires_delta: timedelta) -> str:
        """创建JWT访问令牌"""
        expire = datetime.utcnow() + expires_delta
        to_encode = {"exp": expire, "sub": str(subject)}
        encoded_jwt = jwt.encode(
            to_encode, settings.SECRET_KEY, algorithm=self.jwt_algorithm
        )
        return encoded_jwt

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """验证密码"""
        return self.pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """获取密码哈希值"""
        return self.pwd_context.hash(password)

    def generate_apikey(self) -> str:
        """生成API密钥"""
        return secrets.token_urlsafe(32)

    def generate_short_apikey(self, key: str) -> str:
        """生成短格式API密钥"""
        return f"{key[:4]}...{key[-4:]}"

    def encrypt_api_key(self, data: str) -> str:
        """加密API密钥"""
        if not data:
            return data
        return self._fernet.encrypt(data.encode()).decode()

    def decrypt_api_key(self, encrypted_data: str) -> str:
        """解密API密钥"""
        if not encrypted_data:
            return encrypted_data
        try:
            return self._fernet.decrypt(encrypted_data.encode()).decode()
        except Exception as e:
            raise ValueError("Decryption failed,Invalid API key Token") from e


# 创建单例实例
security_manager = SecurityManager()

# 为了保持向后兼容，保留原有的函数接口
create_access_token = security_manager.create_access_token
verify_password = security_manager.verify_password
get_password_hash = security_manager.get_password_hash
generate_apikey = security_manager.generate_apikey
generate_short_apikey = security_manager.generate_short_apikey
