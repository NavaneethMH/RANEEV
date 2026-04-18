import json
import httpx
import os
from typing import List, Dict
from app.core.redis_client import redis_client
from app.core.config import settings

class NotificationService:
    def __init__(self):
        self.fast2sms_key = os.getenv("FAST2SMS_API_KEY")
        self.twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_from = os.getenv("TWILIO_FROM_NUMBER")
        self.firebase_initialized = False

    async def send_push_notification(self, user_id, title, body, data=None):
        print(f"[{'PUSH':^8}] To user: {user_id:<10} | {title} - {body}")

    async def send_sms(self, phone_number, message):
        if not phone_number:
            return

        print(f"[{'SMS SENT':^8}] Initiating SMS to {phone_number}...")
        
        # 1. Fast2SMS Integration (Good for India standard +91)
        if self.fast2sms_key:
            try:
                # Assuming Indian number string like "+911234567890", strip the +91
                pn = phone_number.replace("+91", "")
                url = "https://www.fast2sms.com/dev/bulkV2"
                querystring = {"authorization": self.fast2sms_key, "message": message, "language": "english", "route": "q", "numbers": pn}
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, params=querystring)
                    print(f"[{'API OK':^8}] Fast2SMS sent successfully to {phone_number}")
                    return True
            except Exception as e:
                print(f"[{'API FAIL':^8}] Fast2SMS exception: {e}")
        
        # 2. Twilio Integration (Global)
        elif self.twilio_sid and self.twilio_token and self.twilio_from:
            try:
                url = f"https://api.twilio.com/2010-04-01/Accounts/{self.twilio_sid}/Messages.json"
                auth = (self.twilio_sid, self.twilio_token)
                data = {"From": self.twilio_from, "To": phone_number, "Body": message}
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, auth=auth, data=data)
                    print(f"[{'API OK':^8}] Twilio sent successfully to {phone_number}")
                    return True
            except Exception as e:
                print(f"[{'API FAIL':^8}] Twilio exception: {e}")

        # 3. Fallback Mock SMS
        print(f"[{'SMS MOCK':^8}] No API keys found. MOCK SMS to {phone_number}:\n          => {message}")
        return True

    async def notify_responders(self, emergency_id, responders, emergency_details):
        notification_data = {
            "emergency_id": emergency_id,
            "type": "emergency_alert",
            "lat": emergency_details["lat"],
            "lng": emergency_details["lng"],
            "severity": emergency_details.get("severity", 5),
            "description": emergency_details.get("description", "Emergency assistance needed")
        }
        for responder in responders:
            redis_client.publish(f"user:{responder['user_id']}:notifications", notification_data)
            await self.send_push_notification(
                str(responder['user_id']),
                "🚨 Emergency Alert!",
                f"Emergency {emergency_id} - {responder['distance_km']:.1f}km away"
            )
            # Create compelling SMS message
            etype = emergency_details.get("type", "medical").upper()
            msg = f"RANEEV ALERT: {etype} Emergency nearby! {responder['distance_km']:.1f}km away. Open the app immediately to respond."
            await self.send_sms(responder['phone'], msg)
