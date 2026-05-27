from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from models.database import Base


class SpotStatus(str, enum.Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    MAINTENANCE = "maintenance"


class ParkingSpot(Base):
    __tablename__ = "parking_spots"

    id = Column(Integer, primary_key=True, index=True)
    spot_number = Column(String, unique=True, index=True, nullable=False)
    zone = Column(String, index=True, nullable=False)
    floor = Column(Integer, default=1)
    status = Column(Enum(SpotStatus), default=SpotStatus.AVAILABLE, index=True)
    is_handicap = Column(Boolean, default=False)
    is_ev_charging = Column(Boolean, default=False)
    last_occupied_at = Column(DateTime, nullable=True)
    last_freed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    # bookings = relationship("Booking", back_populates="parking_spot")
    occupancy_logs = relationship("OccupancyLog", back_populates="parking_spot", cascade="all, delete-orphan")


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    spot_id = Column(Integer, ForeignKey("parking_spots.id"), nullable=False, index=True)
    vehicle_license = Column(String, nullable=False)
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING, index=True)
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=False, index=True)
    actual_start_time = Column(DateTime, nullable=True)
    actual_end_time = Column(DateTime, nullable=True)
    price = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    # user = relationship("User", back_populates="bookings")
    # parking_spot = relationship("ParkingSpot", back_populates="bookings")


class OccupancyLog(Base):
    __tablename__ = "occupancy_logs"

    id = Column(Integer, primary_key=True, index=True)
    spot_id = Column(Integer, ForeignKey("parking_spots.id"), nullable=False, index=True)
    status = Column(Enum(SpotStatus), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    duration_minutes = Column(Integer, nullable=True)

    # Relationships
    parking_spot = relationship("ParkingSpot", back_populates="occupancy_logs")
