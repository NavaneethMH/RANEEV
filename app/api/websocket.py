from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict
import json
from app.core.redis_client import redis_client

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        print(f"User {user_id} connected via WebSocket")

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        print(f"User {user_id} disconnected")

    async def send_personal_message(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
                return True
            except:
                self.disconnect(user_id)
        return False

    async def broadcast(self, message: dict):
        disconnected = []
        for user_id, connection in self.active_connections.items():
            try:
                await connection.send_json(message)
            except:
                disconnected.append(user_id)
        for user_id in disconnected:
            self.disconnect(user_id)

manager = WebSocketManager()

async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(user_id, websocket)
    pubsub = redis_client.subscribe(f"user:{user_id}:notifications")
    try:
        while True:
            message = pubsub.get_message(timeout=0.1)
            if message and message.get('type') == 'message':
                data = json.loads(message['data'])
                await manager.send_personal_message(user_id, data)
            try:
                data = await websocket.receive_text()
                await manager.send_personal_message(user_id, {"echo": data})
            except WebSocketDisconnect:
                break
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(user_id)
