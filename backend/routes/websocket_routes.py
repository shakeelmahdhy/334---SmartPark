from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from models.database import get_db
from controllers.parking_controller import ParkingController
from utils.websocket_manager import manager
import json

router = APIRouter()


@router.websocket("/ws/parking")
async def websocket_parking_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time parking updates"""
    await manager.connect(websocket)

    try:
        # Send initial data
        db_gen = get_db()
        db = next(db_gen)

        try:
            initial_stats = ParkingController.get_dashboard_stats(db)
            await manager.send_personal_message({
                "type": "initial_data",
                "data": json.loads(initial_stats.model_dump_json())
            }, websocket)
        finally:
            db.close()

        # Keep connection alive and listen for messages
        while True:
            data = await websocket.receive_text()
            # Echo back or handle client messages if needed
            await manager.send_personal_message({
                "type": "pong",
                "message": "Connection alive"
            }, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)
