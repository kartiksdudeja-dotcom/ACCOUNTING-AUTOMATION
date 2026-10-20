from app.database import SessionLocal
from app.models.expense import Expense

db = SessionLocal()

expenses = {
    "April_2024": 97613,
    "May_2024": 448760,
    "June_2024": 47035,
    "July_2024": 52670,
    "August_2024": 134145,
    "September_2024": 54060,
    "October_2024": 87810,
    "November_2024": 57711,
    "December_2024": 71690,
    "January_2025": 100630,
    "February_2025": 104185,
    "March_2025": 55800,
    "April_2025": 49660,
    "May_2025": 123985,
    "June_2025": 159633,
    "July_2025": 45200,
    "August_2025": 56845,
    "September_2025": 118590,
    "October_2025": 73463,
    "November_2025": 93570,
    "December_2025": 56160,
    "Jan_2026": 68140,
    "Feb_2026": 118933,
    "March_2026": 37370,
    "April_2026": 34425
}

for month, amount in expenses.items():

    existing = db.query(Expense).filter(
        Expense.expense_month == month
    ).first()

    if existing:
        continue

    expense = Expense(
        expense_month=month,
        amount=amount
    )

    db.add(expense)

db.commit()

print("Expenses Imported Successfully")