from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class OwnerExtraPayment(Base):

    __tablename__ = "owner_extra_payments"

    id = Column(Integer, primary_key=True, index=True)

    unit_no = Column(String)

    date = Column(String)

    amount = Column(Float)

    remarks = Column(String)
