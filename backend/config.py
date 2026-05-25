from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Smart Parking Management System"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite:///./parking_system.db"

    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production-09876543210"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # CORS
    CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]

    # WebSocket
    WS_MESSAGE_QUEUE_SIZE: int = 100

    # Parking System
    TOTAL_PARKING_SPOTS: int = 100
    ZONES: list = ["A", "B", "C", "D"]
    SPOTS_PER_ZONE: int = 25

    class Config:
        env_file = ".env"


settings = Settings()
