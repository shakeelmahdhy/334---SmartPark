from sqlalchemy.orm import Session

from models.database import SessionLocal
from models.user import User
from controllers.auth_controller import hash_password


def create_admin():
    db: Session = SessionLocal()
    try:
        username = "admin"
        email = "admin@example.com"
        raw_password = "admin123"  

        # Check if an admin with this username already exists
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            print("Admin user already exists:", existing.username)
            return

        admin = User(
            username=username,
            email=email,
            full_name="System Admin",
            phone="0000000000",
            hashed_password=hash_password(raw_password),
            is_active=True,
            is_admin=True,
        )
        db.add(admin)
        db.commit()
        print("Admin created:")
        print("  username:", username)
        print("  email:", email)
        print("  password:", raw_password)
    finally:
        db.close()


if __name__ == "__main__":
    create_admin()