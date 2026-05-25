from fastapi import WebSocket
from typing import List, Dict
import json
import asyncio


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int = None):
        await websocket.accept()
        self.active_connections.append(websocket)

        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

        if user_id and user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def send_to_user(self, message: dict, user_id: int):
        if user_id in self.user_connections:
            for connection in self.user_connections[user_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                disconnected.append(connection)

        # Remove disconnected connections
        for connection in disconnected:
            self.disconnect(connection)

    async def broadcast_parking_update(self, spot_data: dict):
        message = {
            "type": "parking_update",
            "data": spot_data
        }
        await self.broadcast(message)

    async def broadcast_booking_update(self, booking_data: dict):
        message = {
            "type": "booking_update",
            "data": booking_data
        }
        await self.broadcast(message)

    async def broadcast_stats_update(self, stats_data: dict):
        message = {
            "type": "stats_update",
            "data": stats_data
        }
        await self.broadcast(message)


manager = ConnectionManager()
