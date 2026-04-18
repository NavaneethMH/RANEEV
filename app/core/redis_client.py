import json

class MockPubSub:
    def subscribe(self, channel):
        print(f"[MOCK REDIS] Subscribed to {channel}")
    
    def get_message(self, timeout=0.1):
        return None

class MockRedis:
    def __init__(self):
        self.data = {}

    def publish(self, channel, message):
        if isinstance(message, dict):
            message = json.dumps(message)
        print(f"[MOCK REDIS] Publishing to {channel}: {message}")
        return 1

    def subscribe(self, channel):
        pubsub = MockPubSub()
        pubsub.subscribe(channel)
        return pubsub

    def pubsub(self):
        return MockPubSub()

    def setex(self, key, ttl, value):
        self.data[key] = value
        return True

    def set(self, key, value):
        self.data[key] = value
        return True

    def get(self, key):
        return self.data.get(key)

    def keys(self, pattern):
        prefix = pattern.replace('*', '')
        return [k for k in self.data.keys() if prefix in k]

    def set_location(self, user_id: str, lat: float, lng: float, user_type: str):
        key = f"location:{user_type}:{user_id}"
        self.data[key] = json.dumps({"lat": lat, "lng": lng, "type": user_type})
        print(f"[MOCK REDIS] Location set for {user_type} {user_id}: ({lat}, {lng})")
        return True

redis_client = MockRedis()
