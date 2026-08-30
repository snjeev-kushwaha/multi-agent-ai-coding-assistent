"""
One-off script to seed an admin user directly into the database.
Does NOT expose any HTTP endpoint or transient admin route.

Usage:
    python scripts/seed_admin.py --email admin@example.com --password YourSecurePassword
    python scripts/seed_admin.py  (will use ADMIN_EMAIL/ADMIN_PASSWORD env vars or prompt)
"""
import argparse
import getpass
import os
import sys
from pathlib import Path

# Ensure backend root is in sys.path
BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import select

from app.core.security import hash_password
from app.db.models import Base, User
from app.db.sync_session import SyncSessionLocal, _sync_engine


def seed_admin(email: str, password: str) -> None:
    if not email or "@" not in email:
        print(f"Error: Invalid email address '{email}'", file=sys.stderr)
        sys.exit(1)

    if not password or len(password) < 8:
        print("Error: Password must be at least 8 characters long", file=sys.stderr)
        sys.exit(1)

    # Ensure tables exist
    Base.metadata.create_all(bind=_sync_engine)

    with SyncSessionLocal() as session:
        result = session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user:
            user.is_admin = True
            user.hashed_password = hash_password(password)
            session.commit()
            session.refresh(user)
            print(f"[SUCCESS] Existing user '{user.email}' (ID: {user.id}) promoted to ADMIN with updated password.")
        else:
            user = User(
                email=email,
                hashed_password=hash_password(password),
                is_admin=True,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            print(f"[SUCCESS] Created new ADMIN user '{user.email}' (ID: {user.id}, is_admin={user.is_admin}).")


def main():
    parser = argparse.ArgumentParser(description="Seed an admin user directly in the database.")
    parser.add_argument("--email", "-e", type=str, default=os.getenv("ADMIN_EMAIL"), help="Admin user email")
    parser.add_argument("--password", "-p", type=str, default=os.getenv("ADMIN_PASSWORD"), help="Admin user password")
    args = parser.parse_args()

    email = args.email
    password = args.password

    if not email:
        email = input("Enter admin email (default: admin@example.com): ").strip()
        if not email:
            email = "admin@example.com"

    if not password:
        if sys.stdin.isatty():
            password = getpass.getpass("Enter admin password: ").strip()
        else:
            password = "AdminPassword123!"

    seed_admin(email=email, password=password)


if __name__ == "__main__":
    main()
