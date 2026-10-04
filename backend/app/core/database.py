import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

raw_url = os.getenv("DATABASE_URL")

if not raw_url:
    raw_url = "sqlite:///./nexora.db"

# Convert generic postgresql:// to explicit postgresql+psycopg2://
if raw_url.startswith("postgresql://"):
    DATABASE_URL = raw_url.replace("postgresql://", "postgresql+psycopg2://", 1)
else:
    DATABASE_URL = raw_url

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
