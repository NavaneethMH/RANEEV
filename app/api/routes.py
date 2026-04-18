from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.core.redis_client import redis_client
from app.models.models import User, Volunteer, Emergency, EmergencyResponse, CoinRedemption
from app.services.matching_engine import MatchingEngine
from datetime import datetime, timedelta
import hashlib
import os
import json

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "raneev-super-secret-key-change-in-production")

# ──────────────────────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    phone_number: Optional[str] = None
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class SOSRequest(BaseModel):
    lat: float
    lng: float
    emergency_type: str = "medical"
    severity: int = 5
    description: Optional[str] = ""
    phone_number: Optional[str] = None
    user_email: Optional[str] = None
    mode: Optional[str] = "ERN"

class GoLiveRequest(BaseModel):
    user_id: int
    lat: float
    lng: float
    skills: Optional[list] = []

class AcceptRequest(BaseModel):
    emergency_id: int
    volunteer_user_id: int

class RedeemCoinsRequest(BaseModel):
    user_email: str
    coins: int

class UserCreateRequest(BaseModel):
    name: str
    email: str
    phone_number: Optional[str] = None
    password: Optional[str] = "default123"

# ──────────────────────────────────────────────────────────────
# Auth helpers
# ──────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return hashlib.sha256((password + SECRET_KEY).encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def make_token(user_id: int, email: str) -> str:
    import base64
    payload = json.dumps({"user_id": user_id, "email": email, "exp": (datetime.utcnow() + timedelta(days=7)).isoformat()})
    return base64.b64encode(payload.encode()).decode()

def decode_token(token: str):
    import base64
    try:
        payload = json.loads(base64.b64decode(token.encode()).decode())
        return payload
    except Exception:
        return None

# ──────────────────────────────────────────────────────────────
# Auth Routes
# ──────────────────────────────────────────────────────────────

@router.post("/auth/register")
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=req.name,
        email=req.email,
        phone_number=req.phone_number,
        password_hash=hash_password(req.password),
        coins=50,  # Welcome bonus
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = make_token(user.id, user.email)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone_number": user.phone_number,
            "trust_score": user.trust_score,
            "coins": user.coins,
            "successful_helps": user.successful_helps,
            "is_volunteer": user.is_volunteer,
        }
    }

@router.post("/auth/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = make_token(user.id, user.email)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone_number": user.phone_number,
            "trust_score": user.trust_score,
            "coins": user.coins,
            "successful_helps": user.successful_helps,
            "is_volunteer": user.is_volunteer,
        }
    }

# ──────────────────────────────────────────────────────────────
# User Routes
# ──────────────────────────────────────────────────────────────

@router.post("/users")
async def create_user(req: UserCreateRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        return {
            "id": existing.id,
            "name": existing.name,
            "email": existing.email,
            "phone_number": existing.phone_number,
            "trust_score": existing.trust_score,
            "coins": existing.coins,
            "successful_helps": existing.successful_helps,
            "is_volunteer": existing.is_volunteer,
        }
    user = User(
        name=req.name,
        email=req.email,
        phone_number=req.phone_number,
        password_hash=hash_password(req.password or "default123"),
        coins=50,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone_number": user.phone_number,
        "trust_score": user.trust_score,
        "coins": user.coins,
        "successful_helps": user.successful_helps,
        "is_volunteer": user.is_volunteer,
    }

@router.get("/profile/{email}")
async def get_profile(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    emergencies = db.query(Emergency).filter(Emergency.user_email == email).all()
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == user.id).first()
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone_number": user.phone_number,
        "trust_score": user.trust_score,
        "coins": user.coins,
        "successful_helps": user.successful_helps,
        "is_volunteer": user.is_volunteer,
        "avatar_color": user.avatar_color,
        "created_at": user.created_at,
        "total_emergencies": len(emergencies),
        "volunteer_info": {
            "is_live": volunteer.is_live,
            "skills": volunteer.skills,
            "badge": volunteer.badge,
        } if volunteer else None,
    }

# ──────────────────────────────────────────────────────────────
# Emergency Routes
# ──────────────────────────────────────────────────────────────

@router.get("/emergencies")
async def list_emergencies(db: Session = Depends(get_db)):
    emergencies = db.query(Emergency).order_by(Emergency.created_at.desc()).limit(100).all()
    result = []
    for e in emergencies:
        result.append({
            "id": e.id,
            "emergency_type": e.emergency_type,
            "severity": e.severity,
            "lat": e.lat,
            "lng": e.lng,
            "description": e.description,
            "user_email": e.user_email,
            "status": e.status,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
        })
    return result

@router.get("/emergencies/{emergency_id}")
async def get_emergency(emergency_id: int, db: Session = Depends(get_db)):
    e = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Emergency not found")
    responses = db.query(EmergencyResponse).filter(EmergencyResponse.emergency_id == e.id).all()
    return {
        "id": e.id,
        "emergency_type": e.emergency_type,
        "severity": e.severity,
        "lat": e.lat,
        "lng": e.lng,
        "description": e.description,
        "user_email": e.user_email,
        "status": e.status,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
        "responders": len(responses),
    }

@router.post("/sos")
async def trigger_sos(sos: SOSRequest, db: Session = Depends(get_db)):
    # Persist emergency directly to DB
    emergency = Emergency(
        emergency_type=sos.emergency_type,
        severity=sos.severity,
        lat=sos.lat,
        lng=sos.lng,
        description=sos.description or "",
        user_email=sos.user_email,
        status="active",
    )
    db.add(emergency)
    db.commit()
    db.refresh(emergency)

    # Also publish to mock redis for worker
    emergency_data = {
        "type": sos.emergency_type,
        "severity": sos.severity,
        "lat": sos.lat,
        "lng": sos.lng,
        "description": sos.description,
        "phone": sos.phone_number,
        "db_id": emergency.id,
    }
    redis_client.publish("emergency:queue", emergency_data)

    # Find & notify responders immediately
    responders = MatchingEngine.find_top_responders(
        db, sos.lat, sos.lng, sos.emergency_type, limit=5
    )

    first_aid_instructions = None
    if sos.emergency_type in ("medical", "GHR"):
        first_aid_instructions = {
            "CPR": "Check responsiveness, call for help, start chest compressions at 100–120/min",
            "Bleeding": "Apply direct pressure with a clean cloth and elevate if possible",
            "Shock": "Keep person warm, lay them down, elevate feet if no other injuries",
        }

    # Award caller coins
    if sos.user_email:
        caller = db.query(User).filter(User.email == sos.user_email).first()
        if caller:
            caller.coins = (caller.coins or 0) + 10
            db.commit()

    return {
        "status": "emergency_triggered",
        "emergency_id": emergency.id,
        "message": f"{sos.emergency_type} emergency response initiated",
        "responders_notified": len(responders),
        "first_aid": first_aid_instructions,
    }

@router.post("/accept")
async def accept_emergency(req: AcceptRequest, db: Session = Depends(get_db)):
    emergency = db.query(Emergency).filter(Emergency.id == req.emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    volunteer = db.query(Volunteer).filter(Volunteer.user_id == req.volunteer_user_id).first()
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    # Create or update response record
    response = db.query(EmergencyResponse).filter(
        EmergencyResponse.emergency_id == req.emergency_id,
        EmergencyResponse.volunteer_id == volunteer.id,
    ).first()

    if not response:
        response = EmergencyResponse(
            emergency_id=req.emergency_id,
            volunteer_id=volunteer.id,
            status="accepted",
        )
        db.add(response)
    else:
        response.status = "accepted"

    emergency.status = "accepted"
    db.commit()

    # Coins reward for volunteer
    user = db.query(User).filter(User.id == req.volunteer_user_id).first()
    if user:
        user.coins = (user.coins or 0) + 25
        user.successful_helps = (user.successful_helps or 0) + 1
        user.trust_score = min(100, user.trust_score + 2)
        db.commit()

    redis_client.publish("emergency:accepted", {
        "emergency_id": req.emergency_id,
        "volunteer_id": volunteer.id,
    })

    return {"status": "accepted", "emergency_id": req.emergency_id, "coins_awarded": 25}

@router.post("/redeem-coins")
async def redeem_coins(req: RedeemCoinsRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.coins < req.coins:
        raise HTTPException(status_code=400, detail="Insufficient coins")
    user.coins -= req.coins
    db.commit()
    
    redemption = CoinRedemption(user_email=req.user_email, coins_spent=req.coins)
    db.add(redemption)
    db.commit()
    
    return {
        "status": "redeemed",
        "coins_spent": req.coins,
        "remaining_coins": user.coins,
        "message": f"Successfully redeemed {req.coins} coins!",
    }

@router.get("/redeem-history/{email}")
async def get_redeem_history(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    history = []
    
    redemptions = db.query(CoinRedemption).filter(CoinRedemption.user_email == email).all()
    for r in redemptions:
        history.append({
            "id": f"red_{r.id}",
            "type": "redeemed",
            "amount": -r.coins_spent,
            "description": "Store Rewards",
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
        
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == user.id).first()
    if volunteer:
        responses = db.query(EmergencyResponse).filter(
            EmergencyResponse.volunteer_id == volunteer.id,
            EmergencyResponse.status == "accepted"
        ).all()
        for res in responses:
            history.append({
                "id": f"res_{res.id}",
                "type": "rewarded",
                "amount": 25,
                "description": "Emergency Resolved",
                "created_at": res.assigned_at.isoformat() if res.assigned_at else None
            })
            
    history.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return history

# ──────────────────────────────────────────────────────────────
# Volunteer Routes
# ──────────────────────────────────────────────────────────────

@router.post("/go-live")
async def go_live(request: GoLiveRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        user = User(
            id=request.user_id,
            name=f"Volunteer_{request.user_id}",
            phone_number=f"+91{request.user_id}",
            is_volunteer=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    volunteer = db.query(Volunteer).filter(Volunteer.user_id == user.id).first()
    if not volunteer:
        volunteer = Volunteer(
            user_id=user.id,
            skills=request.skills or ["First Aid"],
            is_live=True,
            current_lat=request.lat,
            current_lng=request.lng,
            last_location_update=datetime.utcnow(),
        )
        db.add(volunteer)
    else:
        volunteer.is_live = True
        volunteer.current_lat = request.lat
        volunteer.current_lng = request.lng
        volunteer.last_location_update = datetime.utcnow()
        if request.skills:
            volunteer.skills = request.skills
    db.commit()

    redis_client.set_location(str(user.id), request.lat, request.lng, "volunteer")
    user.is_volunteer = True
    db.commit()

    return {"status": "live", "volunteer_id": volunteer.id, "trust_score": user.trust_score}

@router.post("/go-offline")
async def go_offline(user_id: int, db: Session = Depends(get_db)):
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == user_id).first()
    if volunteer:
        volunteer.is_live = False
        db.commit()
    return {"status": "offline"}

@router.get("/volunteers")
async def get_nearby_volunteers(lat: float, lng: float, radius_km: float = 5, db: Session = Depends(get_db)):
    volunteers = db.query(Volunteer).filter(
        Volunteer.is_live == True,
        Volunteer.current_lat.isnot(None),
    ).all()
    nearby = []
    for volunteer in volunteers:
        distance = MatchingEngine.calculate_distance(lat, lng, volunteer.current_lat, volunteer.current_lng)
        if distance <= radius_km:
            user = db.query(User).filter(User.id == volunteer.user_id).first()
            nearby.append({
                "id": volunteer.id,
                "name": user.name if user else "Volunteer",
                "lat": volunteer.current_lat,
                "lng": volunteer.current_lng,
                "distance": round(distance, 2),
                "skills": volunteer.skills,
                "trust_score": user.trust_score if user else 50,
            })
    return {"volunteers": nearby}

@router.post("/update-location")
async def update_location(user_id: int, lat: float, lng: float, db: Session = Depends(get_db)):
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == user_id).first()
    if volunteer:
        volunteer.current_lat = lat
        volunteer.current_lng = lng
        volunteer.last_location_update = datetime.utcnow()
        db.commit()
        redis_client.set_location(str(user_id), lat, lng, "volunteer")
        redis_client.publish("location:updates", {"user_id": user_id, "lat": lat, "lng": lng})
        return {"status": "updated"}
    raise HTTPException(status_code=404, detail="Volunteer not found")

@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    total = db.query(Emergency).count()
    active = db.query(Emergency).filter(Emergency.status == "active").count()
    accepted = db.query(Emergency).filter(Emergency.status == "accepted").count()
    resolved = db.query(Emergency).filter(Emergency.status == "resolved").count()
    volunteers_live = db.query(Volunteer).filter(Volunteer.is_live == True).count()
    return {
        "total": total,
        "active": active,
        "accepted": accepted,
        "resolved": resolved,
        "volunteers_live": volunteers_live,
    }

@router.get("/volunteer/growth/{user_id}")
async def get_volunteer_growth(user_id: int, db: Session = Depends(get_db)):
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == user_id).first()
    if not volunteer:
        return []
        
    responses = db.query(EmergencyResponse).filter(
        EmergencyResponse.volunteer_id == volunteer.id,
        EmergencyResponse.status == "accepted"
    ).order_by(EmergencyResponse.assigned_at.asc()).all()

    # Aggregate by date (simple approach)
    growth_data = {}
    for r in responses:
        if r.assigned_at:
            date_str = r.assigned_at.strftime("%Y-%m-%d")
            growth_data[date_str] = growth_data.get(date_str, 0) + 1
    
    # Format for chart: running total or daily count
    chart_data = []
    cumulative = 0
    for date_str, count in growth_data.items():
        cumulative += count
        chart_data.append({
            "date": date_str,
            "daily": count,
            "total": cumulative
        })
        
    return chart_data

@router.get("/volunteer/history/{user_id}")
async def get_volunteer_history(user_id: int, db: Session = Depends(get_db)):
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == user_id).first()
    if not volunteer:
        return []
        
    responses = db.query(EmergencyResponse).filter(
        EmergencyResponse.volunteer_id == volunteer.id,
        EmergencyResponse.status == "accepted"
    ).order_by(EmergencyResponse.assigned_at.desc()).all()
    
    history_data = []
    # Using 25 fixed coins mapped previously when an emergency is accepted
    for r in responses:
        emer = db.query(Emergency).filter(Emergency.id == r.emergency_id).first()
        if emer:
            history_data.append({
                "response_id": r.id,
                "emergency_id": r.emergency_id,
                "emergency_type": emer.emergency_type.capitalize(),
                "severity": emer.severity,
                "date": r.assigned_at.isoformat() if r.assigned_at else None,
                "coins_earned": 25
            })
            
    return history_data
