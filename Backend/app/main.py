from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.members import router
from app.routes import documents
from app.models.member import Member
from app.models.monthly_charge import MonthlyCharge
from app.database import Base, engine
from app.models.expense import Expense
from app.models.sinking_fund import SinkingFund
from app.models.owner_extra_payment import OwnerExtraPayment
from app.models.other_collection import OtherCollection
from app.models.document import Folder, Document
from app.models.bank_transaction import BankTransaction
from app.routes.reminders import router as reminders_router
from app.routes.monthly_status import router as monthly_status_router
from app.routes.reminders import router as reminders_router
from app.routes.bank import router as bank_router
from app.models.expense_voucher import ExpenseVoucher
from dotenv import load_dotenv

load_dotenv()
Base.metadata.create_all(bind=engine)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(reminders_router)
app.include_router(router)
app.include_router(monthly_status_router)
app.include_router(reminders_router)
app.include_router(documents.router)
app.include_router(bank_router)
@app.get("/")
def home():
    return {"message": "Society Management API Running"}