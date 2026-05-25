from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models.parking import SpotStatus, BookingStatus


class ParkingSpotBase(BaseModel):
    spot_number: str
    zone: str
    floor: int = 1
    is_handicap: bool = False
    is_ev_charging: bool = False


class ParkingSpotCreate(ParkingSpotBase):
    pass


class ParkingSpotUpdate(BaseModel):
    status: Optional[SpotStatus] = None
    is_handicap: Optional[bool] = None
    is_ev_charging: Optional[bool] = None


class ParkingSpotResponse(ParkingSpotBase):
    id: int
    status: SpotStatus
    last_occupied_at: Optional[datetime] = None
    last_freed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BookingBase(BaseModel):
    spot_id: int
    vehicle_license: str
    start_time: datetime
    end_time: datetime


class BookingCreate(BookingBase):
    pass


class BookingUpdate(BaseModel):
    status: Optional[BookingStatus] = None
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None


class BookingResponse(BookingBase):
    id: int
    user_id: int
    status: BookingStatus
    price: float
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    created_at: datetime
    parking_spot: Optional[ParkingSpotResponse] = None

    class Config:
        from_attributes = True


class OccupancyLogResponse(BaseModel):
    id: int
    spot_id: int
    status: SpotStatus
    timestamp: datetime
    duration_minutes: Optional[int] = None

    class Config:
        from_attributes = True


class ZoneStats(BaseModel):
    zone: str
    total_spots: int
    available: int
    occupied: int
    reserved: int
    occupancy_rate: float


class DashboardStats(BaseModel):
    total_spots: int
    available: int
    occupied: int
    reserved: int
    overall_occupancy_rate: float
    zone_stats: List[ZoneStats]
    recent_bookings: List[BookingResponse]


class RecommendationRequest(BaseModel):
    start_time: datetime
    end_time: datetime
    zone_preference: Optional[str] = None
    ev_charging: bool = False
    handicap: bool = False


class RecommendationResponse(BaseModel):
    recommended_spots: List[ParkingSpotResponse]
    zone_availability: dict
    predicted_occupancy: dict
