from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models.database import get_db
from models.user import User
from controllers.auth_controller import get_current_active_user
from controllers.booking_controller import BookingController
from schemas.parking import (
    BookingCreate,
    BookingResponse,
    RecommendationRequest,
    RecommendationResponse,
)

router = APIRouter(
    prefix="/bookings",
    tags=["Bookings"],
)


@router.get("/ping")
def booking_ping():
    return {"message": "booking router is alive"}


@router.post("/", response_model=BookingResponse)
def create_booking(
    booking_data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return BookingController.create_booking(
        booking_data=booking_data,
        user_id=current_user.id,
        db=db
    )


@router.get("/my", response_model=List[BookingResponse])
def get_my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return BookingController.get_user_bookings(
        user_id=current_user.id,
        db=db
    )


@router.put("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return BookingController.cancel_booking(
        booking_id=booking_id,
        user_id=current_user.id,
        db=db
    )


@router.post("/recommendations", response_model=RecommendationResponse)
def get_smart_recommendations(
    recommendation_data: RecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return BookingController.get_smart_recommendations(
        recommendation_data=recommendation_data,
        db=db
    )
