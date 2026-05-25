from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, date


class AnalyticsDateRange(BaseModel):
    start_date: date
    end_date: date


class OccupancyTrend(BaseModel):
    date: str
    occupancy_rate: float
    available: int
    occupied: int


class RevenueTrend(BaseModel):
    date: str
    revenue: float
    bookings: int


class PeakHourData(BaseModel):
    hour: int
    occupancy_rate: float
    bookings: int


class ZonePerformance(BaseModel):
    zone: str
    total_bookings: int
    avg_occupancy_rate: float
    revenue: float


class PredictionData(BaseModel):
    timestamp: str
    predicted_occupancy: float
    confidence: Optional[float] = None


class AnalyticsResponse(BaseModel):
    occupancy_trends: List[OccupancyTrend]
    revenue_trends: List[RevenueTrend]
    peak_hours: List[PeakHourData]
    zone_performance: List[ZonePerformance]
    predictions: List[PredictionData]
    total_revenue: float
    total_bookings: int
    avg_occupancy_rate: float


class DailyAnalyticsResponse(BaseModel):
    id: int
    date: datetime
    total_bookings: int
    total_revenue: float
    avg_occupancy_rate: float
    peak_hour: Optional[int]
    zone_occupancy: Optional[Dict] = None
    created_at: datetime

    class Config:
        from_attributes = True
