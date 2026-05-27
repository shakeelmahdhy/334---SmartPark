from datetime import datetime
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from models.parking import ParkingSpot, Booking, SpotStatus, BookingStatus
from schemas.parking import (
    BookingCreate,
    BookingResponse,
    RecommendationRequest,
    RecommendationResponse,
    ParkingSpotResponse,
)


class BookingController:

    @staticmethod
    def expire_old_bookings(db: Session):
        now = datetime.utcnow()

        expired_bookings = db.query(Booking).filter(
            Booking.end_time < now,
            Booking.status.in_([
                BookingStatus.PENDING,
                BookingStatus.CONFIRMED,
                BookingStatus.ACTIVE,
            ])
        ).all()

        for booking in expired_bookings:
            booking.status = BookingStatus.EXPIRED

            active_count = db.query(func.count(Booking.id)).filter(
                Booking.spot_id == booking.spot_id,
                Booking.status.in_([
                    BookingStatus.PENDING,
                    BookingStatus.CONFIRMED,
                    BookingStatus.ACTIVE,
                ]),
                Booking.end_time >= now,
            ).scalar()

            if active_count == 0:
                spot = db.query(ParkingSpot).filter(ParkingSpot.id == booking.spot_id).first()
                if spot and spot.status == SpotStatus.RESERVED:
                    spot.status = SpotStatus.AVAILABLE
                    spot.last_freed_at = now

        db.commit()

    @staticmethod
    def create_booking(booking_data: BookingCreate, user_id: int, db: Session) -> BookingResponse:
        BookingController.expire_old_bookings(db)

        if booking_data.start_time >= booking_data.end_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start time must be before end time"
            )

        if booking_data.start_time < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking start time cannot be in the past"
            )

        spot = db.query(ParkingSpot).filter(ParkingSpot.id == booking_data.spot_id).first()

        if not spot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parking spot not found"
            )

        if spot.status in [SpotStatus.OCCUPIED, SpotStatus.MAINTENANCE]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parking spot is not available"
            )

        conflict = db.query(Booking).filter(
            Booking.spot_id == booking_data.spot_id,
            Booking.status.in_([
                BookingStatus.PENDING,
                BookingStatus.CONFIRMED,
                BookingStatus.ACTIVE,
            ]),
            Booking.start_time < booking_data.end_time,
            Booking.end_time > booking_data.start_time,
        ).first()

        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This parking spot is already booked for the selected time window"
            )

        duration_hours = (booking_data.end_time - booking_data.start_time).total_seconds() / 3600
        price = round(duration_hours * 5.0, 2)

        new_booking = Booking(
            user_id=user_id,
            spot_id=booking_data.spot_id,
            vehicle_license=booking_data.vehicle_license,
            status=BookingStatus.CONFIRMED,
            start_time=booking_data.start_time,
            end_time=booking_data.end_time,
            price=price,
        )

        spot.status = SpotStatus.RESERVED
        db.add(new_booking)
        db.commit()
        db.refresh(new_booking)

        return BookingResponse.model_validate(new_booking)

    @staticmethod
    def get_user_bookings(user_id: int, db: Session) -> List[BookingResponse]:
        BookingController.expire_old_bookings(db)

        bookings = db.query(Booking).filter(
            Booking.user_id == user_id
        ).order_by(Booking.created_at.desc()).all()

        return [BookingResponse.model_validate(booking) for booking in bookings]

    @staticmethod
    def cancel_booking(booking_id: int, user_id: int, db: Session) -> BookingResponse:
        BookingController.expire_old_bookings(db)

        booking = db.query(Booking).filter(
            Booking.id == booking_id,
            Booking.user_id == user_id
        ).first()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        if booking.status in [BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.EXPIRED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel a booking with status '{booking.status.value}'"
            )

        booking.status = BookingStatus.CANCELLED
        booking.actual_end_time = datetime.utcnow()

        active_count = db.query(func.count(Booking.id)).filter(
            Booking.spot_id == booking.spot_id,
            Booking.id != booking.id,
            Booking.status.in_([
                BookingStatus.PENDING,
                BookingStatus.CONFIRMED,
                BookingStatus.ACTIVE,
            ]),
            Booking.end_time >= datetime.utcnow(),
        ).scalar()

        if active_count == 0:
            spot = db.query(ParkingSpot).filter(ParkingSpot.id == booking.spot_id).first()
            if spot and spot.status == SpotStatus.RESERVED:
                spot.status = SpotStatus.AVAILABLE
                spot.last_freed_at = datetime.utcnow()

        db.commit()
        db.refresh(booking)

        return BookingResponse.model_validate(booking)

    @staticmethod
    def get_smart_recommendations(
        recommendation_data: RecommendationRequest,
        db: Session
    ) -> RecommendationResponse:
        BookingController.expire_old_bookings(db)

        if recommendation_data.start_time >= recommendation_data.end_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start time must be before end time"
            )

        query = db.query(ParkingSpot).filter(
            ParkingSpot.status == SpotStatus.AVAILABLE
        )

        if recommendation_data.zone_preference:
            query = query.filter(ParkingSpot.zone == recommendation_data.zone_preference)

        if recommendation_data.ev_charging:
            query = query.filter(ParkingSpot.is_ev_charging == True)

        if recommendation_data.handicap:
            query = query.filter(ParkingSpot.is_handicap == True)

        candidate_spots = query.all()

        recommended_spots = []

        for spot in candidate_spots:
            conflict = db.query(Booking).filter(
                Booking.spot_id == spot.id,
                Booking.status.in_([
                    BookingStatus.PENDING,
                    BookingStatus.CONFIRMED,
                    BookingStatus.ACTIVE,
                ]),
                Booking.start_time < recommendation_data.end_time,
                Booking.end_time > recommendation_data.start_time,
            ).first()

            if not conflict:
                recommended_spots.append(spot)

        zone_availability = {}
        zones = db.query(ParkingSpot.zone).distinct().all()

        for (zone,) in zones:
            total = db.query(func.count(ParkingSpot.id)).filter(
                ParkingSpot.zone == zone
            ).scalar()

            available = db.query(func.count(ParkingSpot.id)).filter(
                ParkingSpot.zone == zone,
                ParkingSpot.status == SpotStatus.AVAILABLE
            ).scalar()

            zone_availability[zone] = {
                "total_spots": total,
                "available_spots": available,
                "availability_rate": round((available / total * 100), 2) if total else 0
            }

        predicted_occupancy = {}

        for zone, data in zone_availability.items():
            predicted_occupancy[zone] = {
                "predicted_occupancy_rate": round(100 - data["availability_rate"], 2),
                "recommendation_reason": "Based on current availability and low congestion"
            }

        recommended_spots = sorted(
            recommended_spots,
            key=lambda spot: zone_availability.get(spot.zone, {}).get("availability_rate", 0),
            reverse=True
        )[:10]

        return RecommendationResponse(
            recommended_spots=[
                ParkingSpotResponse.model_validate(spot) for spot in recommended_spots
            ],
            zone_availability=zone_availability,
            predicted_occupancy=predicted_occupancy
        )
