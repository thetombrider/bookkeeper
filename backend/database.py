from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Create data directory if it doesn't exist
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

# Use DATABASE_URL from environment if available, otherwise use local path
DEFAULT_DB_PATH = os.path.join(DATA_DIR, 'bookkeeper.db')
SQLALCHEMY_DATABASE_URL = os.getenv('DATABASE_URL', f"sqlite:///{DEFAULT_DB_PATH}")

# Ensure SQLite URLs are properly formatted
if SQLALCHEMY_DATABASE_URL.startswith('sqlite:///') and not SQLALCHEMY_DATABASE_URL.startswith('sqlite:////'):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace('sqlite:///', 'sqlite:////')

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}  # Needed for SQLite
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 