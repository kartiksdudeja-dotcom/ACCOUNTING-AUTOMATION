from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class SinkingFund(Base):

    __tablename__ = "sinking_funds"

    id = Column(Integer, primary_key=True, index=True)

    unit_no = Column(String)

    amount = Column(Float)

    paid_amount = Column(Float)

    due_amount = Column(Float)