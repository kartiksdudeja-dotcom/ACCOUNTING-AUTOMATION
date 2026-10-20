import pandas as pd
from app.database import SessionLocal
from app.models.sinking_fund import SinkingFund

file_path = r"C:\Users\karti\OneDrive\Desktop\SAAS PRODUCT\Backend\Book123.xlsx"

df = pd.read_excel(file_path)

df.columns = df.columns.str.strip()

db = SessionLocal()

for _, row in df.iterrows():

    unit_no = str(row["unit no"]).strip()

    value = row["Sinking Fund"]

    if pd.isna(value):
        paid_amount = 0
        due_amount = 15000
    else:
        paid_amount = 15000
        due_amount = 0

    existing = db.query(SinkingFund).filter(
        SinkingFund.unit_no == unit_no
    ).first()

    if existing:
        continue

    sinking = SinkingFund(
        unit_no=unit_no,
        amount=15000,
        paid_amount=paid_amount,
        due_amount=due_amount
    )

    db.add(sinking)

db.commit()

print("Sinking Fund Imported Successfully")