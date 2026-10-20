from sqlalchemy import Column, Integer, String, Float
from app.database import Base


class MonthlyCharge(Base):
    __tablename__ = "monthly_charges"

    id = Column(Integer, primary_key=True, index=True)
    unit_no = Column(String)
    charge_month = Column(String)
    amount = Column(Float)
    paid_amount = Column(Float)
    due_amount = Column(Float)