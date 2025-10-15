"""
Encryption service for securing sensitive data like API keys.
This service provides encryption/decryption functionality for storing credentials securely.
"""

import base64
import os

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


class EncryptionService:
    """Service for encrypting and decrypting sensitive data."""

    def __init__(self):
        self._key = self._get_or_create_key()
        self._fernet = Fernet(self._key)

    def _get_or_create_key(self) -> bytes:
        """Get existing encryption key or create a new one."""
        # Use environment variable for the key or generate one
        key_string = os.getenv("ENCRYPTION_KEY")

        if key_string:
            return base64.urlsafe_b64decode(key_string.encode())

        # Generate a new key if none exists
        password = os.getenv("SECRET_KEY", "canvas-mcp-client-default-secret")
        salt = os.getenv("ENCRYPTION_SALT", "canvas-mcp-salt").encode()

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        return base64.urlsafe_b64encode(kdf.derive(password.encode()))

    def encrypt(self, data: str) -> str:
        """Encrypt a string and return base64 encoded result."""
        if not data:
            return ""

        encrypted_data = self._fernet.encrypt(data.encode())
        return base64.urlsafe_b64encode(encrypted_data).decode()

    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt a base64 encoded encrypted string."""
        if not encrypted_data:
            return ""

        encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
        decrypted_data = self._fernet.decrypt(encrypted_bytes)
        return decrypted_data.decode()

    def is_encrypted(self, data: str) -> bool:
        """Check if a string is encrypted (basic validation)."""
        try:
            # Try to decode as base64 and decrypt
            encrypted_bytes = base64.urlsafe_b64decode(data.encode())
            self._fernet.decrypt(encrypted_bytes)
            return True
        except Exception:
            return False
