from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from fastapi import HTTPException, status
from typing import List
from datetime import datetime, timedelta, timezone
from models.parking import ParkingSpot, Booking, BookingStatus, SpotStatus
from models.user import User
from config import settings
from schemas.parking import (
    BookingCreate, BookingResponse, BookingUpdate,
    RecommendationRequest, RecommendationResponse, ParkingSpotResponse,
    BookingQuoteRequest, BookingQuoteResponse
)


class BookingController:
    @staticmethod
    def _to_naive_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    @staticmethod
    def _calculate_price(start_time: datetime, end_time: datetime) -> tuple[float, float]:
        start_time = BookingController._to_naive_utc(start_time)
        end_time = BookingController._to_naive_utc(end_time)
        duration_hours = (end_time - start_time).total_seconds() / 3600
        if duration_hours <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End time must be after start time"
            )
        return duration_hours, round(duration_hours * settings.HOURLY_RATE, 2)

    @staticmethod
    def _sync_spot_after_booking_release(booking: Booking, spot: ParkingSpot, db: Session) -> None:
        remaining_booking = db.query(Booking).filter(
            and_(
                Booking.spot_id == booking.spot_id,
                Booking.id != booking.id,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.ACTIVE])
            )
        ).first()
        spot.status = SpotStatus.RESERVED if remaining_booking else SpotStatus.AVAILABLE

    @staticmethod
    def get_booking_quote(
        quote_data: BookingQuoteRequest,
        db: Session
    ) -> BookingQuoteResponse:
        spot = db.query(ParkingSpot).filter(ParkingSpot.id == quote_data.spot_id).first()
        if not spot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parking spot not found"
            )

        if spot.status != SpotStatus.AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parking spot is not available"
            )

        start_time = BookingController._to_naive_utc(quote_data.start_time)
        end_time = BookingController._to_naive_utc(quote_data.end_time)
        duration_hours, price = BookingController._calculate_price(
            start_time,
            end_time
        )

        return BookingQuoteResponse(
            spot_id=quote_data.spot_id,
            duration_hours=round(duration_hours, 2),
            hourly_rate=settings.HOURLY_RATE,
            total_price=price,
        )

    @staticmethod
    def create_booking(
        booking_data: BookingCreate,
        user_id: int,
        db: Session
    ) -> BookingResponse:
        # Verify parking spot exists
        spot = db.query(ParkingSpot).filter(ParkingSpot.id == booking_data.spot_id).first()
        if not spot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parking spot not found"
            )

        if spot.status != SpotStatus.AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parking spot is not available"
            )

        start_time = BookingController._to_naive_utc(booking_data.start_time)
        end_time = BookingController._to_naive_utc(booking_data.end_time)

        # Check if spot is available for the requested time
        conflicting_booking = db.query(Booking).filter(
            and_(
                Booking.spot_id == booking_data.spot_id,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
                or_(
                    and_(
                        Booking.start_time <= start_time,
                        Booking.end_time > start_time
                    ),
                    and_(
                        Booking.start_time < end_time,
                        Booking.end_time >= end_time
                    ),
                    and_(
                        Booking.start_time >= start_time,
                        Booking.end_time <= end_time
                    )
                )
            )
        ).first()

        if conflicting_booking:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parking spot is already booked for the requested time"
            )

        _, price = BookingController._calculate_price(
            start_time,
            end_time
        )

        # Create booking
        new_booking = Booking(
            user_id=user_id,
            spot_id=booking_data.spot_id,
            vehicle_license=booking_data.vehicle_license,
            start_time=start_time,
            end_time=end_time,
            price=price,
            status=BookingStatus.CONFIRMED
        )

        db.add(new_booking)

        spot.status = SpotStatus.RESERVED

        db.commit()
        db.refresh(new_booking)

        # Load the parking spot relationship
        db.refresh(new_booking, attribute_names=['parking_spot'])

        return BookingResponse.model_validate(new_booking)

    @staticmethod
    def get_user_bookings(user_id: int, db: Session) -> List[BookingResponse]:
        bookings = db.query(Booking).options(joinedload(Booking.parking_spot)).filter(
            Booking.user_id == user_id
        ).order_by(Booking.created_at.desc()).all()

        return [BookingResponse.model_validate(booking) for booking in bookings]

    @staticmethod
    def get_booking_by_id(booking_id: int, user_id: int, db: Session) -> BookingResponse:
        booking = db.query(Booking).filter(
            and_(Booking.id == booking_id, Booking.user_id == user_id)
        ).first()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        return BookingResponse.model_validate(booking)

    @staticmethod
    def update_booking(
        booking_id: int,
        update_data: BookingUpdate,
        user_id: int,
        db: Session
    ) -> BookingResponse:
        booking = db.query(Booking).filter(
            and_(Booking.id == booking_id, Booking.user_id == user_id)
        ).first()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        # Update fields
        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(booking, key, value)

        # Update spot status based on booking status
        spot = db.query(ParkingSpot).filter(ParkingSpot.id == booking.spot_id).first()
        if update_data.status:
            if update_data.status == BookingStatus.ACTIVE:
                spot.status = SpotStatus.OCCUPIED
                booking.actual_start_time = datetime.utcnow()
            elif update_data.status == BookingStatus.COMPLETED:
                BookingController._sync_spot_after_booking_release(booking, spot, db)
                booking.actual_end_time = datetime.utcnow()
            elif update_data.status == BookingStatus.CANCELLED:
                BookingController._sync_spot_after_booking_release(booking, spot, db)

        db.commit()
        db.refresh(booking)

        return BookingResponse.model_validate(booking)

    @staticmethod
    def cancel_booking(booking_id: int, user_id: int, db: Session) -> BookingResponse:
        booking = db.query(Booking).filter(
            and_(Booking.id == booking_id, Booking.user_id == user_id)
        ).first()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        if booking.status in [BookingStatus.COMPLETED, BookingStatus.CANCELLED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel a completed or already cancelled booking"
            )

        booking.status = BookingStatus.CANCELLED

        # Free up the parking spot only when no other active reservation remains.
        spot = db.query(ParkingSpot).filter(ParkingSpot.id == booking.spot_id).first()
        if spot:
            BookingController._sync_spot_after_booking_release(booking, spot, db)

        db.commit()
        db.refresh(booking)

        return BookingResponse.model_validate(booking)

    @staticmethod
    def get_recommendations(
        request: RecommendationRequest,
        db: Session
    ) -> RecommendationResponse:
        start_time = BookingController._to_naive_utc(request.start_time)
        end_time = BookingController._to_naive_utc(request.end_time)
        BookingController._calculate_price(start_time, end_time)

        # Find available spots
        query = db.query(ParkingSpot).filter(ParkingSpot.status == SpotStatus.AVAILABLE)

        if request.zone_preference:
            query = query.filter(ParkingSpot.zone == request.zone_preference)
        if request.ev_charging:
            query = query.filter(ParkingSpot.is_ev_charging == True)
        if request.handicap:
            query = query.filter(ParkingSpot.is_handicap == True)

        available_spots = query.all()

        # Check for conflicting bookings
        recommended_spots = []
        for spot in available_spots:
            conflicting = db.query(Booking).filter(
                and_(
                    Booking.spot_id == spot.id,
                    Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
                    or_(
                        and_(
                            Booking.start_time <= start_time,
                            Booking.end_time > start_time
                        ),
                        and_(
                            Booking.start_time < end_time,
                            Booking.end_time >= end_time
                        )
                    )
                )
            ).first()

            if not conflicting:
                recommended_spots.append(ParkingSpotResponse.model_validate(spot))

        # Calculate zone availability
        zones = db.query(ParkingSpot.zone).distinct().all()
        zone_availability = {}
        predicted_occupancy = {}

        for (zone,) in zones:
            total = db.query(func.count(ParkingSpot.id)).filter(ParkingSpot.zone == zone).scalar()
            available = db.query(func.count(ParkingSpot.id)).filter(
                and_(ParkingSpot.zone == zone, ParkingSpot.status == SpotStatus.AVAILABLE)
            ).scalar()

            zone_availability[zone] = round((available / total * 100), 2) if total > 0 else 0
            # Simple prediction: assume 70-90% of current rate
            predicted_occupancy[zone] = round(100 - (zone_availability[zone] * 0.8), 2)

        return RecommendationResponse(
            recommended_spots=recommended_spots[:10],  # Limit to top 10
            zone_availability=zone_availability,
            predicted_occupancy=predicted_occupancy
        )

    @staticmethod
    def get_all_bookings(db: Session) -> List[BookingResponse]:
        """Admin function to get all bookings"""
        bookings = db.query(Booking).options(joinedload(Booking.parking_spot)).order_by(
            Booking.created_at.desc()
        ).all()
        return [BookingResponse.model_validate(booking) for booking in bookings]
