import math
from typing import List, Dict
from sqlalchemy.orm import Session
from app.models.models import Volunteer, User

class MatchingEngine:
    @staticmethod
    def calculate_distance(lat1, lng1, lat2, lng2):
        R = 6371
        lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
        c = 2 * math.asin(math.sqrt(a))
        return R * c

    @staticmethod
    def calculate_score(volunteer, user, distance_km, emergency_type):
        distance_score = max(0, 100 - (distance_km * 10))
        skill_bonus = 0
        if volunteer.skills and "CPR" in volunteer.skills:
            skill_bonus += 20
        if volunteer.skills and "First Aid" in volunteer.skills:
            skill_bonus += 15
        if emergency_type == "GHR" and volunteer.skills and "CPR" in volunteer.skills:
            skill_bonus += 30
        trust_score = user.trust_score
        experience_bonus = min(20, user.successful_helps * 2)
        return (distance_score * 0.4) + (skill_bonus * 0.3) + (trust_score * 0.2) + (experience_bonus * 0.1)

    @staticmethod
    def find_top_responders(db: Session, emergency_lat, emergency_lng, emergency_type, limit=5):
        volunteers = db.query(Volunteer).filter(Volunteer.is_live == True).all()
        responders = []
        for volunteer in volunteers:
            user = db.query(User).filter(User.id == volunteer.user_id).first()
            if not user:
                continue
            if volunteer.current_lat and volunteer.current_lng:
                distance = MatchingEngine.calculate_distance(
                    emergency_lat, emergency_lng,
                    volunteer.current_lat, volunteer.current_lng
                )
                if distance <= 10:
                    score = MatchingEngine.calculate_score(volunteer, user, distance, emergency_type)
                    responders.append({
                        "volunteer_id": volunteer.id,
                        "user_id": user.id,
                        "name": user.name,
                        "phone": user.phone_number,
                        "distance_km": round(distance, 2),
                        "score": round(score, 2),
                        "skills": volunteer.skills,
                        "trust_score": user.trust_score
                    })
        responders.sort(key=lambda x: x["score"], reverse=True)
        return responders[:limit]
