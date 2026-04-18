from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, Text
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    name = Column(String)
    password_hash = Column(String, nullable=True)
    is_volunteer = Column(Boolean, default=False)
    trust_score = Column(Float, default=50.0)
    successful_helps = Column(Integer, default=0)
    coins = Column(Integer, default=0)
    avatar_color = Column(String, default="#e83e3e")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Volunteer(Base):
    __tablename__ = "volunteers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    skills = Column(JSON, default=[])
    is_live = Column(Boolean, default=False)
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    last_location_update = Column(DateTime(timezone=True), nullable=True)
    badge = Column(String, default="New Volunteer")
    trust_score = Column(Float, default=50.0)


class Emergency(Base):
    __tablename__ = "emergencies"
    id = Column(Integer, primary_key=True, index=True)
    emergency_type = Column(String)
    severity = Column(Integer, default=5)
    lat = Column(Float)
    lng = Column(Float)
    description = Column(Text)
    user_email = Column(String, nullable=True)
    status = Column(String, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class EmergencyResponse(Base):
    __tablename__ = "emergency_responses"
    id = Column(Integer, primary_key=True, index=True)
    emergency_id = Column(Integer, index=True)
    volunteer_id = Column(Integer, index=True)
    status = Column(String, default="assigned")
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

class CoinRedemption(Base):
    __tablename__ = "coin_redemptions"
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, index=True)
    coins_spent = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
