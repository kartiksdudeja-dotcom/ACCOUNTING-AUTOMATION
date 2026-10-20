from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class Expense(Base):

    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)

    expense_month = Column(String)

    amount = Column(Float)