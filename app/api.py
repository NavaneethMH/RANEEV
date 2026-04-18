from __future__ import annotations

import math
import random
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .models import Emergency, Redeem, User, VolunteerEvent
from .security import create_access_token, hash_password, verify_password


router = APIRouter()


def _avatar_color() -> str:
    choices = ["#e83e3e", "#f97316", "#8b5cf6", "#3b82f6", "#14b8a6", "#22c55e"]
    return random.choice(choices)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone_number: str | None = None
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthOut(BaseModel):
    token: str
    user: dict[str, Any]


class SosIn(BaseModel):
    emergency_type: Literal["medical", "accident", "fire", "crime", "other"] = "other"
    mode: Literal["ERN", "GHR"] = "ERN"
    severity: int = Field(ge=1, le=10, default=5)
    description: str | None = None
    lat: float
    lng: float
    user_email: str | None = None
    phone_number: str | None = None


class AcceptIn(BaseModel):
    emergency_id: int
    volunteer_user_id: int


class GoLiveIn(BaseModel):
    user_id: int
    lat: float
    lng: float
    skills: list[str] = []


class RedeemIn(BaseModel):
    user_email: EmailStr
    coins: int = Field(gt=0)


def _user_public(u: User) -> dict[str, Any]:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "phone_number": u.phone_number,
        "avatar_color": u.avatar_color,
        "coins": u.coins,
        "trust_score": u.trust_score,
        "is_volunteer": u.is_volunteer,
    }


def _profile_out(u: User) -> dict[str, Any]:
    return {
        **_user_public(u),
        "total_emergencies": 0,  # filled by query in endpoint
        "volunteer_info": {
            "is_live": bool(u.volunteer_is_live),
            "lat": u.volunteer_lat,
            "lng": u.volunteer_lng,
            "skills": u.volunteer_skills or [],
        },
    }


@router.post("/auth/register", response_model=AuthOut)
async def register(payload: RegisterIn, session: AsyncSession = Depends(get_session)):
    existing = await session.scalar(select(User).where(User.email == str(payload.email).lower()))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    u = User(
        name=payload.name.strip(),
        email=str(payload.email).lower(),
        phone_number=payload.phone_number,
        password_hash=hash_password(payload.password),
        avatar_color=_avatar_color(),
        coins=50,
        trust_score=60.0,
        is_volunteer=True,  # enables Accept button in UI
        volunteer_is_live=False,
        volunteer_skills=[],
    )
    session.add(u)
    await session.commit()
    await session.refresh(u)

    token = create_access_token(sub=u.email)
    return {"token": token, "user": _user_public(u)}


@router.post("/auth/login", response_model=AuthOut)
async def login(payload: LoginIn, session: AsyncSession = Depends(get_session)):
    u = await session.scalar(select(User).where(User.email == str(payload.email).lower()))
    if not u or not verify_password(payload.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(sub=u.email)
    return {"token": token, "user": _user_public(u)}


@router.post("/users")
async def create_user(data: dict[str, Any], session: AsyncSession = Depends(get_session)):
    # Compatibility endpoint; the client doesn't rely on this for auth.
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="email is required")
    u = await session.scalar(select(User).where(User.email == email))
    if u:
        return _user_public(u)
    u = User(
        name=(data.get("name") or "User").strip(),
        email=email,
        phone_number=data.get("phone_number"),
        password_hash=hash_password(data.get("password") or "password123"),
        avatar_color=_avatar_color(),
        coins=int(data.get("coins") or 0),
        trust_score=float(data.get("trust_score") or 55.0),
        is_volunteer=bool(data.get("is_volunteer") or False),
    )
    session.add(u)
    await session.commit()
    await session.refresh(u)
    return _user_public(u)


@router.get("/profile/{email}")
async def fetch_profile(email: str, session: AsyncSession = Depends(get_session)):
    u = await session.scalar(select(User).where(User.email == email.lower()))
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    total = await session.scalar(
        select(func.count(Emergency.id)).where(Emergency.accepted_by_user_id == u.id)
    )
    out = _profile_out(u)
    out["total_emergencies"] = int(total or 0)
    return out


@router.get("/emergencies")
async def list_emergencies(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(select(Emergency).order_by(Emergency.created_at.desc()).limit(200))).scalars().all()
    return [
        {
            "id": e.id,
            "emergency_type": e.emergency_type,
            "mode": e.mode,
            "severity": e.severity,
            "description": e.description,
            "lat": e.lat,
            "lng": e.lng,
            "user_email": e.user_email,
            "phone_number": e.phone_number,
            "status": e.status,
            "accepted_by_user_id": e.accepted_by_user_id,
            "created_at": e.created_at.isoformat(),
        }
        for e in rows
    ]


@router.get("/emergencies/{emergency_id}")
async def get_emergency(emergency_id: int, session: AsyncSession = Depends(get_session)):
    e = await session.get(Emergency, emergency_id)
    if not e:
        raise HTTPException(status_code=404, detail="Emergency not found")
    return {
        "id": e.id,
        "emergency_type": e.emergency_type,
        "mode": e.mode,
        "severity": e.severity,
        "description": e.description,
        "lat": e.lat,
        "lng": e.lng,
        "user_email": e.user_email,
        "phone_number": e.phone_number,
        "status": e.status,
        "accepted_by_user_id": e.accepted_by_user_id,
        "created_at": e.created_at.isoformat(),
    }


@router.post("/sos")
async def create_sos(payload: SosIn, session: AsyncSession = Depends(get_session)):
    e = Emergency(
        emergency_type=payload.emergency_type,
        mode=payload.mode,
        severity=payload.severity,
        description=payload.description,
        lat=payload.lat,
        lng=payload.lng,
        user_email=payload.user_email,
        phone_number=payload.phone_number,
        status="active",
    )
    session.add(e)
    await session.commit()
    await session.refresh(e)

    live_count = await session.scalar(select(func.count(User.id)).where(User.volunteer_is_live == True))  # noqa: E712
    responders_notified = int(live_count or 0)
    return {"emergency_id": e.id, "responders_notified": responders_notified}


@router.post("/accept")
async def accept_emergency(payload: AcceptIn, session: AsyncSession = Depends(get_session)):
    e = await session.get(Emergency, payload.emergency_id)
    if not e:
        raise HTTPException(status_code=404, detail="Emergency not found")
    if e.status != "active":
        raise HTTPException(status_code=400, detail="Emergency is not active")

    u = await session.get(User, payload.volunteer_user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    e.status = "accepted"
    e.accepted_by_user_id = u.id

    u.coins = int(u.coins or 0) + 25
    u.trust_score = min(100.0, float(u.trust_score or 50.0) + 1.5)

    session.add(
        VolunteerEvent(
            user_id=u.id,
            emergency_id=e.id,
            action="accepted",
            coins_earned=25,
        )
    )
    await session.commit()
    return {"ok": True}


@router.get("/stats")
async def stats(session: AsyncSession = Depends(get_session)):
    total = await session.scalar(select(func.count(Emergency.id)))
    active = await session.scalar(select(func.count(Emergency.id)).where(Emergency.status == "active"))
    accepted = await session.scalar(select(func.count(Emergency.id)).where(Emergency.status == "accepted"))
    resolved = await session.scalar(select(func.count(Emergency.id)).where(Emergency.status == "resolved"))
    volunteers_live = await session.scalar(select(func.count(User.id)).where(User.volunteer_is_live == True))  # noqa: E712
    return {
        "total": int(total or 0),
        "active": int(active or 0),
        "accepted": int(accepted or 0),
        "resolved": int(resolved or 0),
        "volunteers_live": int(volunteers_live or 0),
    }


@router.post("/go-live")
async def go_live(payload: GoLiveIn, session: AsyncSession = Depends(get_session)):
    u = await session.get(User, payload.user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.is_volunteer = True
    u.volunteer_is_live = True
    u.volunteer_lat = payload.lat
    u.volunteer_lng = payload.lng
    u.volunteer_skills = payload.skills
    await session.commit()
    return {"ok": True}


@router.post("/go-offline")
async def go_offline(user_id: int = Query(...), session: AsyncSession = Depends(get_session)):
    u = await session.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.volunteer_is_live = False
    await session.commit()
    return {"ok": True}


@router.post("/update-location")
async def update_location(
    user_id: int = Query(...),
    lat: float = Query(...),
    lng: float = Query(...),
    session: AsyncSession = Depends(get_session),
):
    u = await session.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.volunteer_lat = lat
    u.volunteer_lng = lng
    await session.commit()
    return {"ok": True}


@router.get("/volunteers")
async def nearby_volunteers(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(5.0, gt=0, le=100),
    session: AsyncSession = Depends(get_session),
):
    users = (
        await session.execute(
            select(User).where(
                User.volunteer_is_live == True,  # noqa: E712
                User.volunteer_lat.is_not(None),
                User.volunteer_lng.is_not(None),
            )
        )
    ).scalars().all()

    volunteers = []
    for u in users:
        dist = _haversine_km(lat, lng, float(u.volunteer_lat), float(u.volunteer_lng))
        if dist <= radius_km:
            volunteers.append(
                {
                    "id": u.id,
                    "name": u.name,
                    "lat": u.volunteer_lat,
                    "lng": u.volunteer_lng,
                    "trust_score": u.trust_score,
                    "skills": u.volunteer_skills or [],
                    "distance": round(dist, 2),
                }
            )
    volunteers.sort(key=lambda v: v["distance"])
    return {"volunteers": volunteers}


@router.post("/redeem-coins")
async def redeem(payload: RedeemIn, session: AsyncSession = Depends(get_session)):
    u = await session.scalar(select(User).where(User.email == str(payload.user_email).lower()))
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if (u.coins or 0) < payload.coins:
        raise HTTPException(status_code=400, detail="Not enough coins")

    u.coins = int(u.coins) - int(payload.coins)
    session.add(Redeem(user_email=u.email, coins=int(payload.coins)))
    await session.commit()
    return {"remaining_coins": u.coins}


@router.get("/redeem-history/{email}")
async def redeem_history(email: str, session: AsyncSession = Depends(get_session)):
    user = await session.scalar(select(User).where(User.email == email.lower()))
    if not user:
        return []

    redeem_rows = (
        await session.execute(
            select(Redeem).where(Redeem.user_email == email.lower()).order_by(Redeem.created_at.desc()).limit(200)
        )
    ).scalars().all()

    earn_rows = (
        await session.execute(
            select(VolunteerEvent)
            .where(VolunteerEvent.user_id == user.id)
            .order_by(VolunteerEvent.created_at.desc())
            .limit(200)
        )
    ).scalars().all()

    events: list[dict[str, Any]] = []

    for r in redeem_rows:
        events.append(
            {
                "id": f"redeem-{r.id}",
                "description": f"Redeemed {r.coins} coins",
                "amount": -int(r.coins),
                "created_at": r.created_at.isoformat(),
            }
        )

    for ev in earn_rows:
        if ev.coins_earned:
            desc = "Volunteer reward"
            if ev.action == "accepted" and ev.emergency_id:
                desc = f"Accepted emergency #{ev.emergency_id}"
            events.append(
                {
                    "id": f"earn-{ev.id}",
                    "description": desc,
                    "amount": int(ev.coins_earned),
                    "created_at": ev.created_at.isoformat(),
                }
            )

    events.sort(key=lambda x: x["created_at"], reverse=True)
    return events[:200]


@router.get("/volunteer/growth/{user_id}")
async def volunteer_growth(user_id: int, session: AsyncSession = Depends(get_session)):
    today = date.today()
    start = today - timedelta(days=13)
    start_dt = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc)

    rows = (
        await session.execute(
            select(func.date(VolunteerEvent.created_at), func.count(VolunteerEvent.id))
            .where(
                VolunteerEvent.user_id == user_id,
                VolunteerEvent.action == "accepted",
                VolunteerEvent.created_at >= start_dt,
            )
            .group_by(func.date(VolunteerEvent.created_at))
        )
    ).all()

    by_day = {str(d): int(c) for d, c in rows}
    out = []
    for i in range(14):
        d = start + timedelta(days=i)
        out.append({"date": d.isoformat(), "daily": by_day.get(d.isoformat(), 0)})
    return out


@router.get("/volunteer/history/{user_id}")
async def volunteer_history(user_id: int, session: AsyncSession = Depends(get_session)):
    rows = (
        await session.execute(
            select(VolunteerEvent)
            .where(VolunteerEvent.user_id == user_id, VolunteerEvent.action == "accepted")
            .order_by(VolunteerEvent.created_at.desc())
            .limit(200)
        )
    ).scalars().all()

    emergency_ids = [r.emergency_id for r in rows if r.emergency_id is not None]
    emergencies = {}
    if emergency_ids:
        em_rows = (await session.execute(select(Emergency).where(Emergency.id.in_(emergency_ids)))).scalars().all()
        emergencies = {e.id: e for e in em_rows}

    out: list[dict[str, Any]] = []
    for r in rows:
        e = emergencies.get(r.emergency_id) if r.emergency_id else None
        out.append(
            {
                "response_id": r.id,
                "emergency_type": (e.emergency_type if e else "unknown"),
                "severity": (e.severity if e else 0),
                "date": r.created_at.isoformat(),
            }
        )
    return out


@router.post("/notify-ambulance")
async def notify_ambulance(payload: dict[str, Any]):
    # Stub endpoint to keep the UI happy.
    return {"ok": True, "dispatched": False, "message": "Ambulance dispatch integration is not configured in demo mode."}

