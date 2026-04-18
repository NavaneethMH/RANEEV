from __future__ import annotations

import datetime as dt

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone_number: Mapped[str | None] = mapped_column(String(40), nullable=True)

    password_hash: Mapped[str] = mapped_column(String(255))
    avatar_color: Mapped[str | None] = mapped_column(String(64), nullable=True)

    coins: Mapped[int] = mapped_column(Integer, default=50)
    trust_score: Mapped[float] = mapped_column(Float, default=60.0)

    is_volunteer: Mapped[bool] = mapped_column(Boolean, default=False)
    volunteer_is_live: Mapped[bool] = mapped_column(Boolean, default=False)
    volunteer_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    volunteer_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    volunteer_skills: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    volunteer_events: Mapped[list["VolunteerEvent"]] = relationship(back_populates="user")


class Emergency(Base):
    __tablename__ = "emergencies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    emergency_type: Mapped[str] = mapped_column(String(30), default="other")
    mode: Mapped[str] = mapped_column(String(10), default="ERN")
    severity: Mapped[int] = mapped_column(Integer, default=5)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)

    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(40), nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="active")  # active/accepted/resolved
    accepted_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class Redeem(Base):
    __tablename__ = "redeems"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_email: Mapped[str] = mapped_column(String(255), index=True)
    coins: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class VolunteerEvent(Base):
    __tablename__ = "volunteer_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    emergency_id: Mapped[int | None] = mapped_column(ForeignKey("emergencies.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(30))  # accepted/resolved
    coins_earned: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    user: Mapped[User] = relationship(back_populates="volunteer_events")

