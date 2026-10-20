from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class ExpenseVoucher(Base):

    __tablename__ = "expense_vouchers"

    id = Column(Integer, primary_key=True, index=True)

    voucher_no = Column(Integer)

    expense_date = Column(String)

    expense_month = Column(String)

    drawn_on = Column(String)

    particulars = Column(String)

    expense_type = Column(String)

    remarks = Column(String)

    reference_no = Column(String)

    payment_mode = Column(String)

    amount = Column(Float)

    narration = Column(String)

    transaction_id = Column(Integer)

    approved_by = Column(String)

    status = Column(String)

    created_at = Column(String)