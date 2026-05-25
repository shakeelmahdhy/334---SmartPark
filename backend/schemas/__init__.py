from schemas.user import (
    UserBase, UserCreate, UserLogin, UserUpdate, UserResponse,
    Token, TokenData, VehicleBase, VehicleCreate, VehicleResponse
)
from schemas.parking import (
    ParkingSpotBase, ParkingSpotCreate, ParkingSpotUpdate, ParkingSpotResponse,
    BookingBase, BookingCreate, BookingUpdate, BookingResponse,
    OccupancyLogResponse, ZoneStats, DashboardStats,
    RecommendationRequest, RecommendationResponse
)
from schemas.analytics import (
    AnalyticsDateRange, OccupancyTrend, RevenueTrend, PeakHourData,
    ZonePerformance, PredictionData, AnalyticsResponse, DailyAnalyticsResponse
)

__all__ = [
    "UserBase", "UserCreate", "UserLogin", "UserUpdate", "UserResponse",
    "Token", "TokenData", "VehicleBase", "VehicleCreate", "VehicleResponse",
    "ParkingSpotBase", "ParkingSpotCreate", "ParkingSpotUpdate", "ParkingSpotResponse",
    "BookingBase", "BookingCreate", "BookingUpdate", "BookingResponse",
    "OccupancyLogResponse", "ZoneStats", "DashboardStats",
    "RecommendationRequest", "RecommendationResponse",
    "AnalyticsDateRange", "OccupancyTrend", "RevenueTrend", "PeakHourData",
    "ZonePerformance", "PredictionData", "AnalyticsResponse", "DailyAnalyticsResponse",
]
