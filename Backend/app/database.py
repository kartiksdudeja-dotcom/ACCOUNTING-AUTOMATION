from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.engine import URL

DATABASE_URL = URL.create(
    drivername="postgresql+psycopg2",
    username="postgres",
    password="Kartik12345@#",
    host="localhost",
    port=5432,
    database="society_db"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

connection = engine.connect()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

print("Database Connected Successfully")