# auth.py
"""
Simple password-based authentication for the Space Biology Knowledge Engine.
Uses JWT tokens for stateless authentication.

Environment variables:
- APP_PASSWORD: The password users must enter to access the API (REQUIRED)
- JWT_SECRET_KEY: Secret key for signing JWT tokens (auto-generated if not set)
- JWT_EXPIRE_MINUTES: Token expiration time in minutes (default: 1440 = 24 hours)
"""
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
from passlib.context import CryptContext

# Configuration - reload from env each time to support hot-reload
def get_app_password() -> str:
    """Get the APP_PASSWORD, stripping quotes if present."""
    pwd = os.getenv("APP_PASSWORD", "").strip()
    # Remove surrounding quotes if present (common .env issue)
    if (pwd.startswith('"') and pwd.endswith('"')) or (pwd.startswith("'") and pwd.endswith("'")):
        pwd = pwd[1:-1]
    return pwd

APP_PASSWORD = get_app_password()
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24 hours default

# Print password status on load (for debugging)
print(f"[auth] APP_PASSWORD loaded: {'YES' if APP_PASSWORD else 'NO'} (length: {len(APP_PASSWORD)})")

# Password hashing context (for future use if needed)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token security
security = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


def is_auth_enabled() -> bool:
    """Check if authentication is enabled (APP_PASSWORD is set)."""
    return bool(APP_PASSWORD)


def verify_password(plain_password: str) -> bool:
    """Verify the provided password against APP_PASSWORD."""
    if not APP_PASSWORD:
        return True  # No password set = auth disabled
    return plain_password == APP_PASSWORD


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[dict]:
    """
    Dependency that validates the JWT token.
    Returns the token payload if valid, raises HTTPException if invalid.
    If auth is disabled (no APP_PASSWORD), allows all requests.
    """
    # If no password is set, auth is disabled
    if not is_auth_enabled():
        return {"auth": "disabled"}

    # Check for token
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please login first.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate token
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def login(password: str) -> TokenResponse:
    """
    Authenticate with password and return a JWT token.
    """
    if not is_auth_enabled():
        # Auth disabled, return a token anyway for consistency
        token = create_access_token({"sub": "user", "auth": "disabled"})
        return TokenResponse(
            access_token=token,
            expires_in=JWT_EXPIRE_MINUTES * 60
        )

    if not verify_password(password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
        )

    token = create_access_token({"sub": "authenticated_user"})
    return TokenResponse(
        access_token=token,
        expires_in=JWT_EXPIRE_MINUTES * 60
    )
