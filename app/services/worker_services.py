import asyncio
import json
from app.core.database import SessionLocal
from app.core.redis_client import redis_client
from app.models.models import Emergency, EmergencyResponse
from app.services.matching_engine import MatchingEngine
from app.services.notification_services import NotificationService

class WorkerService:
    def __init__(self):
        self.notification_service = NotificationService()
        self.running = True

    async def process_emergency(self, emergency_data: dict):
        db = SessionLocal()
        try:
            emergency = Emergency(
                emergency_type=emergency_data["type"],
                severity=emergency_data.get("severity", 5),
                lat=emergency_data["lat"],
                lng=emergency_data["lng"],
                description=emergency_data.get("description", "")
            )
            db.add(emergency)
            db.commit()
            db.refresh(emergency)

            responders = MatchingEngine.find_top_responders(
                db, emergency.lat, emergency.lng, emergency.emergency_type, limit=5
            )
            for responder in responders:
                response = EmergencyResponse(
                    emergency_id=emergency.id,
                    volunteer_id=responder["volunteer_id"],
                    status="assigned"
                )
                db.add(response)
            db.commit()

            await self.notification_service.notify_responders(emergency.id, responders, emergency_data)
            redis_client.publish("emergency:new", {
                "emergency_id": emergency.id,
                "lat": emergency.lat,
                "lng": emergency.lng,
                "responders": len(responders)
            })
            return {"emergency_id": emergency.id, "responders_notified": len(responders)}
        except Exception as e:
            print(f"Error processing emergency: {e}")
            db.rollback()
            raise
        finally:
            db.close()

    async def run(self):
        pubsub = redis_client.subscribe("emergency:queue")
        while self.running:
            try:
                message = pubsub.get_message(timeout=1.0)
                if message and message.get('type') == 'message':
                    emergency_data = json.loads(message['data'])
                    await self.process_emergency(emergency_data)
                await asyncio.sleep(0.1)
            except Exception as e:
                print(f"Worker error: {e}")
                await asyncio.sleep(1)

worker = WorkerService()

async def start_worker():
    asyncio.create_task(worker.run())
