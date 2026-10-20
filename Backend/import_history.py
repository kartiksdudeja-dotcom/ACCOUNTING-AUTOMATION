import pandas as pd
from app.database import SessionLocal
from app.models.monthly_charge import MonthlyCharge

file_path = r"C:\Users\karti\OneDrive\Desktop\SAAS PRODUCT\Backend\Book123.xlsx"

df = pd.read_excel(file_path)

df.columns = df.columns.str.strip()

db = SessionLocal()

month_columns = [
    "June_2025",
    "July_2025",
    "August_2025",
    "September_2025",
    "October_2025",
    "November_2025",
    "December_2025",
    "Jan_2026",
    "Feb_2026",
    "March_2026",
    "April_2026"
]

for _, row in df.iterrows():

    unit_no = str(row["unit no"]).strip()

    if "SHOP" in unit_no.upper():
        maintenance_amount = 1500
    else:
        maintenance_amount = 2000

    for month in month_columns:

        value = row.get(month)

        if pd.isna(value):
            paid_amount = 0
            due_amount = maintenance_amount
        else:
            paid_amount = float(value)
            due_amount = 0

        existing = db.query(MonthlyCharge).filter(
            MonthlyCharge.unit_no == unit_no,
            MonthlyCharge.charge_month == month
        ).first()

        if existing:
            continue

        charge = MonthlyCharge(
            unit_no=unit_no,
            charge_month=month,
            amount=maintenance_amount,
            paid_amount=paid_amount,
            due_amount=due_amount
        )

        db.add(charge)

db.commit()

print("History Imported Successfully")