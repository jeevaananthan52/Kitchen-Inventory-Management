from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# For development: use SQLite database (file-based, no server needed)
# For production: change to PostgreSQL or another database
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_url = f"sqlite:///{BASE_DIR}/kitchen.db"

# PostgreSQL example: "postgresql://postgre:password@localhost:5432/jeeva"
# db_url="postgresql://postgre:jeeva@localhost:5432/jeeva"


engine = create_engine(db_url, connect_args={"check_same_thread": False} if "sqlite" in db_url else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()