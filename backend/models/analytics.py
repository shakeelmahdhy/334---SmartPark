from sqlalchemy import Column, Integer, String, DateTime, Float, JSON
from datetime import datetime
from models.database import Base


class DailyAnalytics(Base):
    __tablename__ = "daily_analytics"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, index=True, nullable=False)
    total_bookings = Column(Integer, default=0)
    total_revenue = Column(Float, default=0.0)
    avg_occupancy_rate = Column(Float, default=0.0)
    peak_hour = Column(Integer, nullable=True)
    zone_occupancy = Column(JSON, nullable=True)  # {"A": 80, "B": 60, "C": 90, "D": 70}
    created_at = Column(DateTime, default=datetime.utcnow)


class PredictionModel(Base):
    __tablename__ = "prediction_models"

    id = Column(Integer, primary_key=True, index=True)
    model_type = Column(String, index=True, nullable=False)  # "occupancy", "revenue", "peak_hours"
    zone = Column(String, nullable=True)
    parameters = Column(JSON, nullable=True)  # Store model parameters
    accuracy_score = Column(Float, nullable=True)
    last_trained_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
