from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class OtherCollection(Base):

    __tablename__ = "other_collections"

    id = Column(Integer, primary_key=True, index=True)

    date = Column(String)

    amount = Column(Float)

    remarks = Column(String)
