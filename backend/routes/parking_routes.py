from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from models.database import get_db
from models.user import User
from models.parking import SpotStatus
from schemas.parking import (
    ParkingSpotCreate, ParkingSpotResponse, ParkingSpotUpdate,
    DashboardStats
)
from controllers.parking_controller import ParkingController
from utils.security import get_current_active_user, get_current_admin_user
from utils.websocket_manager import manager

router = APIRouter(prefix="/api/parking", tags=["Parking"])


@router.post("/spots", response_model=ParkingSpotResponse)
async def create_parking_spot(
    spot_data: ParkingSpotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create a new parking spot (Admin only)"""
    spot = ParkingController.create_parking_spot(spot_data, db)
    await manager.broadcast_parking_update({"action": "created", "spot": spot.model_dump()})
    return spot


@router.get("/spots", response_model=List[ParkingSpotResponse])
def get_all_parking_spots(
    zone: Optional[str] = Query(None),
    status: Optional[SpotStatus] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all parking spots with optional filters"""
    return ParkingController.get_all_spots(db, zone, status)


@router.get("/spots/{spot_id}", response_model=ParkingSpotResponse)
def get_parking_spot(
    spot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get parking spot by ID"""
    return ParkingController.get_spot_by_id(spot_id, db)


@router.patch("/spots/{spot_id}", response_model=ParkingSpotResponse)
async def update_parking_spot(
    spot_id: int,
    update_data: ParkingSpotUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update parking spot status (Admin only)"""
    spot = ParkingController.update_spot_status(spot_id, update_data, db)
    await manager.broadcast_parking_update({"action": "updated", "spot": spot.model_dump()})
    return spot


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get dashboard statistics"""
    return ParkingController.get_dashboard_stats(db)


@router.post("/initialize", response_model=List[ParkingSpotResponse])
async def initialize_parking_spots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Initialize parking spots (Admin only, run once)"""
    spots = ParkingController.initialize_parking_spots(db)
    if spots:
        await manager.broadcast_parking_update({"action": "initialized", "count": len(spots)})
    return spots
