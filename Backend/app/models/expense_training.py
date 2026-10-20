# app/models/expense_training.py

from sqlalchemy import Column, Integer, String
from app.database import Base

class ExpenseTraining(Base):

    __tablename__ = "expense_training"

    id = Column(Integer, primary_key=True)

    vendor_name = Column(String)

    category = Column(String)