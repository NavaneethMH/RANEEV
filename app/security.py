from __future__ import annotations

import datetime as dt

from jose import jwt
from passlib.context import CryptContext

from .config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(*, sub: str) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    exp = now + dt.timedelta(minutes=settings.jwt_exp_minutes)
    payload = {"sub": sub, "iat": int(now.timestamp()), "exp": int(exp.timestamp())}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)

