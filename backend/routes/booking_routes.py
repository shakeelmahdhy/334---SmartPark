from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from models.database import get_db
from models.user import User
from schemas.parking import (
    BookingCreate, BookingResponse, BookingUpdate,
    RecommendationRequest, RecommendationResponse,
    BookingQuoteRequest, BookingQuoteResponse
)
from controllers.booking_controller import BookingController
from utils.security import get_current_active_user, get_current_admin_user
from utils.websocket_manager import manager

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])


@router.post("/quote", response_model=BookingQuoteResponse)
def get_booking_quote(
    quote_data: BookingQuoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a server-calculated booking price quote"""
    return BookingController.get_booking_quote(quote_data, db)


@router.post("", response_model=BookingResponse)
async def create_booking(
    booking_data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new booking"""
    booking = BookingController.create_booking(booking_data, current_user.id, db)
    await manager.broadcast_booking_update({
        "action": "created",
        "booking": booking.model_dump()
    })
    return booking


@router.get("", response_model=List[BookingResponse])
def get_user_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all bookings for current user"""
    return BookingController.get_user_bookings(current_user.id, db)


@router.get("/all", response_model=List[BookingResponse])
def get_all_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get all bookings (Admin only)"""
    return BookingController.get_all_bookings(db)


@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get booking by ID"""
    return BookingController.get_booking_by_id(booking_id, current_user.id, db)


@router.patch("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: int,
    update_data: BookingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update booking"""
    booking = BookingController.update_booking(booking_id, update_data, current_user.id, db)
    await manager.broadcast_booking_update({
        "action": "updated",
        "booking": booking.model_dump()
    })
    return booking


@router.delete("/{booking_id}", response_model=BookingResponse)
async def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cancel a booking"""
    booking = BookingController.cancel_booking(booking_id, current_user.id, db)
    await manager.broadcast_booking_update({
        "action": "cancelled",
        "booking": booking.model_dump()
    })
    return booking


@router.post("/recommendations", response_model=RecommendationResponse)
def get_recommendations(
    request: RecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get parking spot recommendations"""
    return BookingController.get_recommendations(request, db)
