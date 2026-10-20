from sqlalchemy import Column, Integer, String, Float, Boolean
from app.database import Base
class BankTransaction(Base):

    __tablename__ = "bank_transactions"

    id = Column(Integer, primary_key=True, index=True)

    transaction_date = Column(String)

    narration = Column(String)

    amount = Column(Float)

    transaction_type = Column(String)

    reference_no = Column(String)

    closing_balance = Column(Float)

    matched_unit = Column(String)

    matched_owner = Column(String)

    status = Column(String)

    accounting_posted = Column(Boolean, default=False)