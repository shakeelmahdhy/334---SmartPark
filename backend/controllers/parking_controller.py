from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from typing import List, Optional
from datetime import datetime
from models.parking import ParkingSpot, SpotStatus, OccupancyLog
from schemas.parking import (
    ParkingSpotCreate, ParkingSpotResponse, ParkingSpotUpdate,
    ZoneStats, DashboardStats
)


class ParkingController:
    @staticmethod
    def create_parking_spot(spot_data: ParkingSpotCreate, db: Session) -> ParkingSpotResponse:
        # Check if spot number already exists
        existing_spot = db.query(ParkingSpot).filter(
            ParkingSpot.spot_number == spot_data.spot_number
        ).first()

        if existing_spot:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parking spot number already exists"
            )

        new_spot = ParkingSpot(**spot_data.model_dump())
        db.add(new_spot)
        db.commit()
        db.refresh(new_spot)

        return ParkingSpotResponse.model_validate(new_spot)

    @staticmethod
    def get_all_spots(
        db: Session,
        zone: Optional[str] = None,
        status: Optional[SpotStatus] = None
    ) -> List[ParkingSpotResponse]:
        query = db.query(ParkingSpot)

        if zone:
            query = query.filter(ParkingSpot.zone == zone)
        if status:
            query = query.filter(ParkingSpot.status == status)

        spots = query.all()
        return [ParkingSpotResponse.model_validate(spot) for spot in spots]

    @staticmethod
    def get_spot_by_id(spot_id: int, db: Session) -> ParkingSpotResponse:
        spot = db.query(ParkingSpot).filter(ParkingSpot.id == spot_id).first()
        if not spot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parking spot not found"
            )
        return ParkingSpotResponse.model_validate(spot)

    @staticmethod
    def update_spot_status(
        spot_id: int,
        update_data: ParkingSpotUpdate,
        db: Session
    ) -> ParkingSpotResponse:
        spot = db.query(ParkingSpot).filter(ParkingSpot.id == spot_id).first()
        if not spot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parking spot not found"
            )

        # Update fields
        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(spot, key, value)

        # Update timestamps based on status change
        if update_data.status:
            if update_data.status == SpotStatus.OCCUPIED:
                spot.last_occupied_at = datetime.utcnow()
            elif update_data.status == SpotStatus.AVAILABLE:
                spot.last_freed_at = datetime.utcnow()

            # Log occupancy change
            log = OccupancyLog(
                spot_id=spot_id,
                status=update_data.status,
                timestamp=datetime.utcnow()
            )
            db.add(log)

        db.commit()
        db.refresh(spot)

        return ParkingSpotResponse.model_validate(spot)

    @staticmethod
    def get_dashboard_stats(db: Session) -> DashboardStats:
        # Get overall stats
        total_spots = db.query(func.count(ParkingSpot.id)).scalar()
        available = db.query(func.count(ParkingSpot.id)).filter(
            ParkingSpot.status == SpotStatus.AVAILABLE
        ).scalar()
        occupied = db.query(func.count(ParkingSpot.id)).filter(
            ParkingSpot.status == SpotStatus.OCCUPIED
        ).scalar()
        reserved = db.query(func.count(ParkingSpot.id)).filter(
            ParkingSpot.status == SpotStatus.RESERVED
        ).scalar()

        overall_occupancy_rate = (occupied / total_spots * 100) if total_spots > 0 else 0

        # Get zone stats
        zones = db.query(ParkingSpot.zone).distinct().all()
        zone_stats = []

        for (zone,) in zones:
            zone_total = db.query(func.count(ParkingSpot.id)).filter(
                ParkingSpot.zone == zone
            ).scalar()
            zone_available = db.query(func.count(ParkingSpot.id)).filter(
                ParkingSpot.zone == zone,
                ParkingSpot.status == SpotStatus.AVAILABLE
            ).scalar()
            zone_occupied = db.query(func.count(ParkingSpot.id)).filter(
                ParkingSpot.zone == zone,
                ParkingSpot.status == SpotStatus.OCCUPIED
            ).scalar()
            zone_reserved = db.query(func.count(ParkingSpot.id)).filter(
                ParkingSpot.zone == zone,
                ParkingSpot.status == SpotStatus.RESERVED
            ).scalar()

            zone_occupancy_rate = (zone_occupied / zone_total * 100) if zone_total > 0 else 0

            zone_stats.append(ZoneStats(
                zone=zone,
                total_spots=zone_total,
                available=zone_available,
                occupied=zone_occupied,
                reserved=zone_reserved,
                occupancy_rate=round(zone_occupancy_rate, 2)
            ))

        return DashboardStats(
            total_spots=total_spots,
            available=available,
            occupied=occupied,
            reserved=reserved,
            overall_occupancy_rate=round(overall_occupancy_rate, 2),
            zone_stats=zone_stats,
            recent_bookings=[]
        )

    @staticmethod
    def initialize_parking_spots(db: Session) -> List[ParkingSpotResponse]:
        """Initialize parking spots if database is empty"""
        existing_count = db.query(func.count(ParkingSpot.id)).scalar()
        if existing_count > 0:
            return []

        zones = ["A", "B", "C", "D"]
        spots_per_zone = 25
        created_spots = []

        for zone in zones:
            for i in range(1, spots_per_zone + 1):
                spot = ParkingSpot(
                    spot_number=f"{zone}{i:02d}",
                    zone=zone,
                    floor=1,
                    status=SpotStatus.AVAILABLE,
                    is_handicap=(i % 10 == 0),  # Every 10th spot is handicap
                    is_ev_charging=(i % 5 == 0)  # Every 5th spot has EV charging
                )
                db.add(spot)
                created_spots.append(spot)

        db.commit()
        for spot in created_spots:
            db.refresh(spot)

        return [ParkingSpotResponse.model_validate(spot) for spot in created_spots]
