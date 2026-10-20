import re
import traceback
import io
import openpyxl
from datetime import datetime
from openpyxl.styles import Font
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import pandas as pd
from app.models.ai_training import AITraining
from app.database import SessionLocal, get_db
from app.models.bank_transaction import BankTransaction
from app.models.member import Member
from app.models.expense_training import ExpenseTraining
from app.models.expense_voucher import ExpenseVoucher
from app.models.monthly_charge import MonthlyCharge
from app.models.sinking_fund import SinkingFund


router = APIRouter()


def _normalize_column_name(value):
    if value is None:
        return ""
    return re.sub(r"[^a-z0-9]+", " ", str(value).strip().lower()).strip()


def _get_matching_column(columns, candidates):
    normalized = {_normalize_column_name(col): col for col in columns if col is not None}
    for candidate in candidates:
        match = normalized.get(candidate)
        if match is not None:
            return match
    for candidate in candidates:
        for key, value in normalized.items():
            if candidate in key:
                return value
    return None


def _read_bank_statement(file_obj, engine):
    file_obj.seek(0)

    raw_df = pd.read_excel(
        file_obj,
        engine=engine,
        header=None
    )

    if raw_df.empty:
        raise ValueError("Uploaded file is empty.")

    # Find the REAL bank statement header.
    # Require BOTH Date and Narration instead of matching
    # any random word from the rows above.
    header_row = None

    for idx in range(min(len(raw_df), 50)):
        row_values = [
            str(value).strip().lower()
            if pd.notna(value)
            else ""
            for value in raw_df.iloc[idx].tolist()
        ]

        normalized_values = [
            _normalize_column_name(value)
            for value in row_values
        ]

        has_date = any(
            value in ("date", "transaction date", "value date", "posting date")
            for value in normalized_values
        )

        has_narration = any(
            value in (
                "narration",
                "transaction narration",
                "description",
                "particulars",
                "details"
            )
            for value in normalized_values
        )

        # HDFC statement has BOTH Date and Narration
        if has_date and has_narration:
            header_row = idx
            break

    if header_row is None:
        raise ValueError(
            "Could not detect the bank statement header row. "
            "Expected columns such as Date and Narration."
        )

    # Use the detected row as column headers
    df = raw_df.iloc[header_row + 1:].copy()
    df.columns = raw_df.iloc[header_row].tolist()

    # Clean column names
    df.columns = [
        str(col).strip() if pd.notna(col) else ""
        for col in df.columns
    ]

    # Remove completely empty columns
    df = df.loc[:, [col != "" for col in df.columns]]

    # Remove completely empty rows
    df = df.dropna(how="all")

    return df


def detect_unit(narration):
    narration = narration.upper()

    match = re.search(r'OFFICE\s*(\d+)', narration)
    if match:
        return match.group(1)

    match = re.search(r'SHOP\s*NO\s*(\d+)', narration)
    if match:
        return match.group(1)

    match = re.search(r'UNIT\s*(\d+)', narration)
    if match:
        return match.group(1)

    match = re.search(r'\b(\d{3})\s*MAINT', narration)
    if match:
        return match.group(1)

def extract_expense_details(narration: str, existing_drawn_on: str = None, existing_ref: str = None):
    narration_str = str(narration or "").strip()
    drawn_on = (existing_drawn_on or "").strip()
    particulars = ""
    ref_no = (existing_ref or "").strip()

    # 1. Extract Ref No (12-16 digits with 0000 prefix if 12 digits as in standard Indian UPI statement)
    if not ref_no or ref_no.lower() == "nan":
        ref_match = re.search(r'\b(\d{12,16})\b', narration_str)
        if ref_match:
            raw_ref = ref_match.group(1)
            if len(raw_ref) == 12:
                ref_no = "0000" + raw_ref
            else:
                ref_no = raw_ref
        else:
            ref_match2 = re.search(r'[-/](\d{6,16})[-/]', narration_str)
            if ref_match2:
                ref_no = ref_match2.group(1)

    parts = [p.strip() for p in narration_str.split("-") if p.strip()]

    # 2. Extract Drawn On (Payee / Vendor Name)
    if not drawn_on or drawn_on.upper() in ["UPI", "NEFT", "EXPENSE", "DEBIT"]:
        if narration_str.upper().startswith("UPI-") and len(parts) > 1:
            raw_name = parts[1].strip()
            clean_name = re.sub(r'[\d@].*$', '', raw_name).strip()
            drawn_on = clean_name if len(clean_name) >= 3 else raw_name
        elif len(parts) > 1:
            drawn_on = parts[1].strip()
        else:
            drawn_on = parts[0].strip() if parts else "EXPENSE"

    # 3. Extract Particulars (Purpose / Description)
    KNOWN_PARTICULARS = {
        "WATER TANKER": "water tanker",
        "TANKER": "water tanker",
        "WACHMAN": "caretaker salary/ garbage",
        "WATCHMAN": "caretaker salary/ garbage",
        "CARETAKER": "caretaker salary/ garbage",
        "GARBAGE": "Garbage Expense",
        "MANAGER": "Manager Salary",
        "LIFT AMC": "LIFT AMC",
        "LIFT": "LIFT AMC",
        "CLEANING": "CLEANING STUFF",
        "MOTOR REPAIR": "MOTOR REPAIR MATERIAL",
        "MOTOR": "MOTOR REPAIR MATERIAL",
        "MOTAR": "MOTOR REPAIR MATERIAL",
        "PUMP RENT": "MOTOR PUMP ON RENT",
        "PUMP": "MOTOR PUMP ON RENT",
        "ELECTRICITY": "ELECTRICITY BILL",
        "BILLPAY": "ELECTRICITY BILL",
        "MSEDCL": "ELECTRICITY BILL",
        "PANEL": "ELECTRICAL PANEL SERVICE",
        "DIESEL": "DIESEL",
        "LETTER": "LETTER HEAD PRINT",
        "AUDIT": "AUDIT FEES",
        "ACCOUNTING": "ACCOUNTING",
        "ADVANCE": "CARETAKER ADVANCE SALARY",
        "SECURITY": "SECURITY CHARGES",
        "CEMENT": "CEMENT / OTHER MATERIAL",
        "PLUMBING": "PLUMBING REPAIR",
        "GARDENING": "GARDEN MAINTENANCE",
        "STATIONERY": "STATIONERY EXPENSE",
        "LEGAL": "LEGAL FEES"
    }

    if len(parts) >= 3:
        last_part = parts[-1].strip()
        if not re.match(r'^\d+$', last_part) and not re.match(r'^[A-Z0-9]{8,}$', last_part) and last_part.upper() != "UPI":
            particulars = last_part

    if not particulars:
        upper_narration = narration_str.upper()
        for kw, desc in KNOWN_PARTICULARS.items():
            if kw in upper_narration:
                particulars = desc
                break

    if not particulars:
        if len(parts) > 2 and len(parts[-1]) >= 3 and not re.match(r'^\d+$', parts[-1]):
            particulars = parts[-1]
        elif len(parts) > 1:
            particulars = parts[0]
        else:
            particulars = "Expense"

    return drawn_on[:50], particulars[:80], ref_no[:30]


def _process_bank_internal(db: Session, reprocess_all: bool = False):
    """Core AI processing logic - shared between /bank/process and auto-run after upload."""
    if reprocess_all:
        transactions = db.query(BankTransaction).filter(BankTransaction.accounting_posted == False).all()
    else:
        transactions = db.query(BankTransaction).filter(BankTransaction.status == "PENDING").all()
        if not transactions:
            transactions = db.query(BankTransaction).filter(BankTransaction.accounting_posted == False).all()

    # Automatically purge contaminated generic rules (e.g. UPI, NEFT, empty keywords)
    for bad_kw in ["UPI", "NEFT", "RTGS", "IMPS", "DR", "CR", "", " ", "-", "PAYMENT", "TRANSFER", "OKICICI", "OKAXIS", "OKHDFCBANK", "OKSBI", "YBL", "IBL", "PAYTM", "GPAY"]:
        db.query(AITraining).filter(AITraining.keyword.ilike(bad_kw)).delete(synchronize_session=False)
    db.commit()

    members = db.query(Member).all()
    vendors = db.query(ExpenseTraining).all()
    trainings = db.query(AITraining).all()

    maintenance = 0
    expense = 0
    review = 0

    member_by_unit = {str(m.unit_no).strip().upper(): m for m in members if m.unit_no}

    STOP_WORDS = {
        "THE", "AND", "PVT", "LTD", "LIMITED", "PRIVATE", "SHRI", "SHREE", "MRS", "MR", "DR",
        "FOR", "UPI", "NEFT", "IMPS", "RTGS", "BANK", "PAY", "ACC", "ACCOUNT", "TRANSFER",
        "CR", "DR", "TO", "BY", "FROM", "IN", "ON", "AT", "OF", "WITH", "NO", "NUM", "NUMBER",
        "MAINT", "MAINTENANCE", "CHARGES", "SOCIETY", "FLAT", "SHOP", "OFFICE", "UNIT", "BLDG",
        "BUILDING", "WING", "FLOOR", "EXPENSE", "PAYMENT", "MONTHLY", "OKICICI", "OKAXIS",
        "OKHDFCBANK", "OKSBI", "YBL", "IBL", "PAYTM", "GPAY"
    }

    GENERIC_KEYWORDS = {
        "", " ", "UPI", "NEFT", "IMPS", "RTGS", "TRANSFER", "DR", "CR", "PAYMENT", "TO", "BY",
        "-", "OKICICI", "OKAXIS", "OKHDFCBANK", "OKSBI", "YBL", "IBL", "PAYTM", "GPAY"
    }

    for tx in transactions:
        narration = (tx.narration or "").upper()
        clean_narration = re.sub(r'[^A-Z0-9 ]', ' ', narration)
        clean_narration = re.sub(r'\s+', ' ', clean_narration).strip()
        narration_words = set(clean_narration.split())

        is_credit = (tx.transaction_type == "CREDIT")
        is_debit = (tx.transaction_type == "DEBIT")

        # --- 1. SINKING FUND (CREDIT only) ---
        if is_credit and "SINK" in narration:
            tx.status = "SINKING_FUND"
            unit_no = detect_unit(narration)
            if unit_no and unit_no.upper() in member_by_unit:
                m = member_by_unit[unit_no.upper()]
                tx.matched_unit = str(m.unit_no)
                tx.matched_owner = m.new_owner or m.old_owner or ""
            maintenance += 1
            continue

        # --- 2. DEBIT TRANSACTIONS (EXPENSES ONLY - NEVER MAINTENANCE) ---
        if is_debit:
            matched_debit = False
            # Check AI Training specifically for EXPENSE rules
            for train in trainings:
                kw = (train.keyword or "").strip().upper()
                if kw and kw not in GENERIC_KEYWORDS and len(kw) >= 3:
                    if kw in narration and (train.category == "EXPENSE" or not train.unit_no):
                        tx.status = "EXPENSE"
                        tx.matched_unit = ""
                        tx.matched_owner = train.owner_name or kw
                        matched_debit = True
                        expense += 1
                        break

            if matched_debit:
                continue

            # Check Expense Vendors
            for vendor in vendors:
                vname = str(vendor.vendor_name or "").strip().upper()
                if vname and vname not in GENERIC_KEYWORDS and len(vname) >= 3:
                    if vname in narration:
                        tx.status = "EXPENSE"
                        tx.matched_unit = ""
                        tx.matched_owner = vendor.vendor_name
                        matched_debit = True
                        expense += 1
                        break

            if matched_debit:
                continue

            # Default all remaining DEBITs to EXPENSE
            tx.status = "EXPENSE"
            tx.matched_unit = ""
            parts = tx.narration.split("-")
            if tx.narration.startswith("UPI-") and len(parts) > 1:
                tx.matched_owner = parts[1].strip()[:50]
            elif len(parts) > 1 and len(parts[1].strip()) >= 3:
                tx.matched_owner = parts[1].strip()[:50]
            else:
                tx.matched_owner = parts[0].strip()[:50]
            expense += 1
            continue

        # --- 3. CREDIT TRANSACTIONS (MAINTENANCE / MEMBER RECEIPTS) ---
        # A. Detect explicit unit number in narration
        unit_no = detect_unit(narration)
        if unit_no and unit_no.upper() in member_by_unit:
            m = member_by_unit[unit_no.upper()]
            tx.status = "MAINTENANCE"
            tx.matched_unit = str(m.unit_no)
            tx.matched_owner = m.new_owner or m.old_owner or ""
            maintenance += 1
            continue

        # B. Match by Member Owner Name
        owner_matches = {}
        for member in members:
            raw_owner = str(member.new_owner or "").strip().upper()
            if not raw_owner:
                continue

            owner_lines = re.split(r'[\r\n]+', raw_owner)
            for individual_owner in owner_lines:
                clean_owner = re.sub(r'[^A-Z0-9 ]', ' ', individual_owner)
                clean_owner = re.sub(r'\s+', ' ', clean_owner).strip()
                tokens = [t for t in clean_owner.split() if len(t) >= 3 and t not in STOP_WORDS]
                if not tokens:
                    continue

                matching_tokens = [t for t in tokens if t in narration_words]

                # Strong match: 2+ tokens or single unique token >= 5 chars
                if len(matching_tokens) >= 2 or (len(tokens) == 1 and len(tokens[0]) >= 5 and tokens[0] in narration_words):
                    owner_matches.setdefault(individual_owner, []).append(str(member.unit_no))
                    break

        if owner_matches:
            best_owner = max(owner_matches, key=lambda o: len(owner_matches[o]))
            matched_units = list(dict.fromkeys(owner_matches[best_owner]))
            tx.status = "MAINTENANCE"
            tx.matched_unit = ",".join(matched_units)
            tx.matched_owner = best_owner
            maintenance += 1
            continue

        # C. AI Training Rules (for CREDIT transactions)
        matched_credit_ai = False
        for train in trainings:
            kw = (train.keyword or "").strip().upper()
            if kw and kw not in GENERIC_KEYWORDS and len(kw) >= 3:
                if kw in clean_narration or kw in narration:
                    tx.status = train.category or "MAINTENANCE"
                    tx.matched_unit = train.unit_no or ""
                    tx.matched_owner = train.owner_name or ""
                    if not tx.matched_owner and tx.matched_unit and tx.matched_unit.upper() in member_by_unit:
                        tx.matched_owner = member_by_unit[tx.matched_unit.upper()].new_owner or ""
                    matched_credit_ai = True
                    if tx.status == "MAINTENANCE":
                        maintenance += 1
                    elif tx.status == "EXPENSE":
                        expense += 1
                    break

        if matched_credit_ai:
            continue

        # D. Unmatched CREDIT transactions go to REVIEW
        tx.status = "REVIEW"
        tx.matched_unit = ""
        tx.matched_owner = ""
        review += 1

    db.commit()

    # Automatically generate expense vouchers for all EXPENSE transactions
    expenses = db.query(BankTransaction).filter(BankTransaction.status == "EXPENSE").all()
    v_count = db.query(ExpenseVoucher).count()
    for tx in expenses:
        existing_v = db.query(ExpenseVoucher).filter(ExpenseVoucher.transaction_id == tx.id).first()
        drawn_on, particulars, ref_no = extract_expense_details(tx.narration, tx.matched_owner, tx.reference_no)

        try:
            date_obj = pd.to_datetime(tx.transaction_date, dayfirst=True)
            month_name = date_obj.strftime('%B')
            year = date_obj.year
            expense_month = f"{month_name}_{year}"
        except Exception:
            expense_month = ""

        if not existing_v:
            v_count += 1
            voucher = ExpenseVoucher(
                voucher_no=v_count,
                expense_date=tx.transaction_date,
                expense_month=expense_month,
                drawn_on=drawn_on,
                particulars=particulars,
                expense_type="",
                remarks="",
                reference_no=ref_no,
                payment_mode="UPI" if "UPI" in tx.narration.upper() else "BANK",
                amount=tx.amount,
                narration=tx.narration,
                transaction_id=tx.id,
                status="APPROVED"
            )
            db.add(voucher)
        else:
            if not existing_v.drawn_on or existing_v.drawn_on.upper() in ["UPI", "EXPENSE", "DEBIT"]:
                existing_v.drawn_on = drawn_on
            if not existing_v.particulars:
                existing_v.particulars = particulars
            if not existing_v.reference_no or len(existing_v.reference_no) < 8:
                existing_v.reference_no = ref_no

    db.commit()
    return {
        "maintenance_detected": maintenance,
        "expense_detected": expense,
        "review_required": review
    }


@router.post("/bank/process")
def process_bank(db: Session = Depends(get_db)):
    return _process_bank_internal(db, reprocess_all=True)


@router.post("/bank/upload")
async def upload_bank(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename.lower()
    if filename.endswith((".xlsx", ".xlsm")):
        engine = "openpyxl"
    elif filename.endswith(".xls"):
        engine = "xlrd"
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload an .xlsx/.xlsm file or install xlrd for .xls support.")

    try:
        df = _read_bank_statement(file.file, engine)
    except Exception as exc:
        traceback.print_exc()
        if isinstance(exc, ValueError):
            raise HTTPException(status_code=400, detail=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))

    date_col = _get_matching_column(df.columns, ["date", "transaction date", "value date", "posting date"])
    narration_col = _get_matching_column(df.columns, ["narration", "transaction narration", "description", "particulars", "details"])
    withdrawal_col = _get_matching_column(df.columns, ["withdrawal amt", "withdrawal amount", "debit amt", "debit amount", "withdrawal", "debit"])
    deposit_col = _get_matching_column(df.columns, ["deposit amt", "deposit amount", "credit amt", "credit amount", "deposit", "credit"])
    closing_col = _get_matching_column(df.columns, ["closing balance", "balance", "closing amt", "balance amt"])
    ref_col = _get_matching_column(df.columns, ["chq ref no", "chq ref no", "ref no", "cheque no", "reference no", "ref no"])

    if not date_col or not narration_col:
        raise HTTPException(status_code=400, detail="Uploaded file does not look like a bank statement. Required columns like Date and Narration were not found.")

    df = df[[col for col in [date_col, narration_col, withdrawal_col, deposit_col, closing_col, ref_col] if col is not None]]
    df = df.rename(columns={
        date_col: 'Date',
        narration_col: 'Narration',
        withdrawal_col: 'Withdrawal Amt.' if withdrawal_col else 'Withdrawal Amt.',
        deposit_col: 'Deposit Amt.' if deposit_col else 'Deposit Amt.',
        closing_col: 'Closing Balance' if closing_col else 'Closing Balance',
        ref_col: 'Chq./Ref.No.' if ref_col else 'Chq./Ref.No.'
    })
    df = df.dropna(subset=['Date', 'Narration'])

    count = 0

    for _, row in df.iterrows():
        date_val = row.get('Date')
        if pd.isna(date_val):
            continue

        try:
            parsed_date = pd.to_datetime(date_val, dayfirst=True)
            date_str = parsed_date.strftime('%Y-%m-%d')
        except Exception:
            date_str = str(date_val).split(' ')[0]

        narration = str(row.get('Narration', '')).strip()
        if not narration:
            continue

        withdrawal = row.get('Withdrawal Amt.')
        deposit = row.get('Deposit Amt.')

        if pd.notna(deposit) and str(deposit).strip() not in ("", "nan"):
            try:
                amount = float(str(deposit).replace(',', '').strip())
                transaction_type = "CREDIT"
            except ValueError:
                continue
        elif pd.notna(withdrawal) and str(withdrawal).strip() not in ("", "nan"):
            try:
                amount = float(str(withdrawal).replace(',', '').strip())
                transaction_type = "DEBIT"
            except ValueError:
                continue
        else:
            continue

        try:
            closing_balance = float(str(row.get('Closing Balance', '0')).replace(',', '').strip())
        except (TypeError, ValueError):
            closing_balance = 0.0

        ref_no_raw = row.get('Chq./Ref.No.', '')
        ref_no = "" if pd.isna(ref_no_raw) else str(ref_no_raw).strip()
        if ref_no.lower() == "nan":
            ref_no = ""
        if not ref_no:
            ref_match = re.search(r'\b(\d{12,16})\b', narration)
            if ref_match:
                raw_ref = ref_match.group(1)
                ref_no = "0000" + raw_ref if len(raw_ref) == 12 else raw_ref

        existing = db.query(BankTransaction).filter(
            BankTransaction.transaction_date == date_str,
            BankTransaction.narration == narration,
            BankTransaction.amount == amount,
            BankTransaction.transaction_type == transaction_type
        ).first()

        if existing:
            continue

        transaction = BankTransaction(
            transaction_date=date_str,
            narration=narration,
            amount=amount,
            transaction_type=transaction_type,
            reference_no=ref_no,
            closing_balance=closing_balance,
            matched_unit="",
            matched_owner="",
            status="PENDING"
        )
        db.add(transaction)
        count += 1

    try:
        db.commit()

        if count > 0:
            _process_bank_internal(db, reprocess_all=True)
    except Exception:
        traceback.print_exc()
        raise

    return {"imported_transactions": count}


@router.delete("/bank/clear")
def clear_bank_data(db: Session = Depends(get_db)):
    db.query(BankTransaction).delete()
    db.query(ExpenseVoucher).delete()
    db.commit()
    return {"message": "All bank data cleared successfully"}


@router.get("/bank/transactions")
def get_transactions(db: Session = Depends(get_db)):
    return db.query(BankTransaction).order_by(BankTransaction.id.desc()).all()


@router.put("/bank/transactions/{tx_id}")
def update_transaction(tx_id: int, data: dict, db: Session = Depends(get_db)):
    tx = db.query(BankTransaction).filter(BankTransaction.id == tx_id).first()
    if not tx:
        return {"error": "Not found"}
    if "status" in data:
        tx.status = data["status"]
    if "matched_unit" in data:
        tx.matched_unit = data["matched_unit"]
    if "matched_owner" in data:
        tx.matched_owner = data["matched_owner"]
    db.commit()
    return {"message": "Updated"}


@router.post("/bank/train")
def train_ai(data: dict, db: Session = Depends(get_db)):
    kw = str(data.get("keyword", "")).strip().upper()
    GENERIC_KEYWORDS = {"", " ", "UPI", "NEFT", "IMPS", "RTGS", "TRANSFER", "DR", "CR", "PAYMENT", "TO", "BY", "-", "OKICICI", "OKAXIS", "OKHDFCBANK", "OKSBI", "YBL", "IBL", "PAYTM", "GPAY"}
    
    if not kw or len(kw) < 3 or kw in GENERIC_KEYWORDS:
        return {"message": "Keyword is too generic or short to train", "skipped": True}

    unit_no = data.get("unit_no", "")
    if isinstance(unit_no, list):
        unit_no = ",".join(str(u) for u in unit_no)

    owner_name = str(data.get("owner_name", "")).strip()
    if not owner_name and unit_no:
        member = db.query(Member).filter(Member.unit_no == unit_no).first()
        if member:
            owner_name = member.new_owner or member.old_owner or ""

    training = AITraining(
        keyword=kw,
        unit_no=unit_no,
        owner_name=owner_name,
        category=data.get("category", "MAINTENANCE")
    )

    db.add(training)

    # Auto-apply new rule to existing REVIEW transactions
    reviews = db.query(BankTransaction).filter(
        BankTransaction.status == "REVIEW"
    ).all()

    for tx in reviews:
        if (
            training.keyword
            and training.keyword.upper() in tx.narration.upper()
        ):
            # Only match maintenance for credit and expense for debit
            if training.category == "MAINTENANCE" and tx.transaction_type == "DEBIT":
                continue
            tx.matched_unit = training.unit_no or ""
            tx.matched_owner = training.owner_name or ""
            tx.status = training.category

    db.commit()
    return {"message": "AI Trained Successfully"}


@router.put("/bank/train/{train_id}")
def update_training(
    train_id: int,
    data: dict,
    db: Session = Depends(get_db)
):

    t = db.query(AITraining).filter(
        AITraining.id == train_id
    ).first()

    if not t:
        return {"error": "Not found"}

    if "keyword" in data:
        t.keyword = data["keyword"]

    if "unit_no" in data:
        val = data["unit_no"]

        t.unit_no = (
            ",".join(str(u) for u in val)
            if isinstance(val, list)
            else str(val)
        )

    if "owner_name" in data:
        t.owner_name = str(data["owner_name"]).strip()

    if "category" in data:
        t.category = data["category"]

    # Auto-apply updated rule
    reviews = db.query(BankTransaction).filter(
        BankTransaction.status == "REVIEW"
    ).all()

    for tx in reviews:
        if (
            t.keyword
            and t.keyword.upper() in tx.narration.upper()
        ):
            tx.matched_unit = t.unit_no or ""
            tx.matched_owner = t.owner_name or ""
            tx.status = t.category

    db.commit()

    return {"message": "Updated"}


@router.delete("/bank/train/{train_id}")
def delete_training(train_id: int, db: Session = Depends(get_db)):
    t = db.query(AITraining).filter(AITraining.id == train_id).first()
    if not t:
        return {"error": "Not found"}
    db.delete(t)
    db.commit()
    return {"message": "Deleted"}


@router.get("/bank/review")
def get_review_transactions(db: Session = Depends(get_db)):
    return db.query(BankTransaction).filter(BankTransaction.status == "REVIEW").all()


@router.get("/bank/training")
def get_training_rules(db: Session = Depends(get_db)):
    return db.query(AITraining).all()


@router.post("/bank/generate-expenses")
def generate_expenses(db: Session = Depends(get_db)):
    expenses = db.query(BankTransaction).filter(BankTransaction.status == "EXPENSE").all()

    count = 0
    for tx in expenses:
        existing = db.query(ExpenseVoucher).filter(
            ExpenseVoucher.transaction_id == tx.id
        ).first()

        drawn_on, particulars, ref_no = extract_expense_details(tx.narration, tx.matched_owner, tx.reference_no)

        try:
            date_obj = pd.to_datetime(tx.transaction_date, dayfirst=True)
            month_name = date_obj.strftime('%B')
            year = date_obj.year
            expense_month = f"{month_name}_{year}"
        except Exception:
            expense_month = ""

        if existing:
            if not existing.drawn_on or existing.drawn_on.upper() in ["UPI", "EXPENSE", "DEBIT"]:
                existing.drawn_on = drawn_on
            if not existing.particulars:
                existing.particulars = particulars
            if not existing.reference_no or len(existing.reference_no) < 8:
                existing.reference_no = ref_no
            continue

        count += 1
        voucher = ExpenseVoucher(
            voucher_no=count,
            expense_date=tx.transaction_date,
            expense_month=expense_month,
            drawn_on=drawn_on,
            particulars=particulars,
            expense_type="",
            remarks="",
            reference_no=ref_no,
            payment_mode="UPI" if "UPI" in tx.narration.upper() else "BANK",
            amount=tx.amount,
            narration=tx.narration,
            transaction_id=tx.id,
            status="APPROVED"
        )
        db.add(voucher)

    db.commit()
    return {"expense_vouchers_created": count}


@router.get("/expenses/vouchers")
def get_expense_vouchers(db: Session = Depends(get_db)):
    vouchers = db.query(ExpenseVoucher).order_by(ExpenseVoucher.voucher_no).all()
    updated = False
    for v in vouchers:
        if not v.drawn_on or v.drawn_on.upper() in ["UPI", "EXPENSE", "DEBIT", ""] or not v.particulars:
            d_on, part, r_no = extract_expense_details(v.narration, v.drawn_on, v.reference_no)
            if not v.drawn_on or v.drawn_on.upper() in ["UPI", "EXPENSE", "DEBIT", ""]:
                v.drawn_on = d_on
                updated = True
            if not v.particulars:
                v.particulars = part
                updated = True
            if not v.reference_no or len(v.reference_no) < 8:
                v.reference_no = r_no
                updated = True
    if updated:
        db.commit()
    return vouchers


@router.post("/bank/submit")
def submit_to_accounting(db: Session = Depends(get_db)):
    # 1. MAINTENANCE
    maintenance_txs = db.query(BankTransaction).filter(
        BankTransaction.status == "MAINTENANCE",
        BankTransaction.accounting_posted == False
    ).all()

    for tx in maintenance_txs:
        if not tx.matched_unit:
            continue
            
        try:
            date_obj = pd.to_datetime(tx.transaction_date, dayfirst=True)
            month_name = date_obj.strftime('%B')
            year = date_obj.year
            charge_month = f"{month_name}_{year}"
        except Exception:
            charge_month = ""

        # Always ensure ALL members have a row for this month first
        members_all = db.query(Member).all()
        for m in members_all:
            existing = db.query(MonthlyCharge).filter(
                MonthlyCharge.unit_no == m.unit_no,
                MonthlyCharge.charge_month == charge_month
            ).first()
            if not existing:
                db.add(MonthlyCharge(unit_no=m.unit_no, charge_month=charge_month, amount=2000.0, paid_amount=0.0, due_amount=2000.0))
        db.flush()  # flush so we can query the new rows

        # Now find the charge row for this transaction's unit
        charge = db.query(MonthlyCharge).filter(
            MonthlyCharge.unit_no == tx.matched_unit,
            MonthlyCharge.charge_month == charge_month
        ).first()

        if charge:
            # Fix amount if it was 0 (e.g. joint units)
            if (charge.amount or 0) == 0:
                units_count = len([u for u in str(tx.matched_unit).split(',') if u.strip()])
                charge.amount = 2000.0 * max(units_count, 1)
            charge.paid_amount = (charge.paid_amount or 0) + tx.amount
            charge.due_amount = charge.amount - charge.paid_amount
        else:
            # Create if still missing (e.g. joint unit not in members)
            charge = MonthlyCharge(
                unit_no=tx.matched_unit,
                charge_month=charge_month,
                amount=2000.0,
                paid_amount=tx.amount,
                due_amount=2000.0 - tx.amount
            )
            db.add(charge)

        tx.accounting_posted = True


    # 2. SINKING_FUND
    sinking_txs = db.query(BankTransaction).filter(
        BankTransaction.status == "SINKING_FUND",
        BankTransaction.accounting_posted == False
    ).all()

    for tx in sinking_txs:
        if not tx.matched_unit:
            continue
            
        fund = db.query(SinkingFund).filter(
            SinkingFund.unit_no == tx.matched_unit
        ).first()

        if fund:
            fund.paid_amount = (fund.paid_amount or 0) + tx.amount
            fund.due_amount = (fund.amount or 0) - fund.paid_amount
        else:
            fund = SinkingFund(
                unit_no=tx.matched_unit,
                amount=0.0,
                paid_amount=tx.amount,
                due_amount=-tx.amount
            )
            db.add(fund)

        tx.accounting_posted = True

    # 3. EXPENSE
    expense_txs = db.query(BankTransaction).filter(
        BankTransaction.status == "EXPENSE",
        BankTransaction.accounting_posted == False
    ).all()
    
    # We can just reuse generate_expenses logic
    count = 0
    for tx in expense_txs:
        existing = db.query(ExpenseVoucher).filter(
            ExpenseVoucher.transaction_id == tx.id
        ).first()

        if existing:
            tx.accounting_posted = True
            continue

        try:
            date_obj = pd.to_datetime(tx.transaction_date, dayfirst=True)
            month_name = date_obj.strftime('%B')
            year = date_obj.year
            expense_month = f"{month_name}_{year}"
        except Exception:
            expense_month = ""

        vendor_name = tx.matched_owner or ""
        narration_parts = tx.narration.split("-")
        short_narration = narration_parts[0].strip() if narration_parts else tx.narration[:50]

        voucher = ExpenseVoucher(
            voucher_no=count + 1,
            expense_date=tx.transaction_date,
            expense_month=expense_month,
            drawn_on=vendor_name,
            particulars=short_narration,
            expense_type="",
            remarks="",
            reference_no=tx.reference_no or "",
            payment_mode="UPI",
            amount=tx.amount,
            narration=tx.narration,
            transaction_id=tx.id,
            status="APPROVED"
        )
        db.add(voucher)
        tx.accounting_posted = True
        count += 1

    db.commit()

    return {
        "maintenance_processed": len(maintenance_txs),
        "sinking_processed": len(sinking_txs),
        "expense_vouchers_created": count
    }


@router.get("/bank/export")
def export_bank_data(db: Session = Depends(get_db)):
    transactions = db.query(BankTransaction).order_by(BankTransaction.transaction_date, BankTransaction.id).all()
    vouchers = db.query(ExpenseVoucher).order_by(ExpenseVoucher.voucher_no).all()
    
    if not transactions:
        raise HTTPException(status_code=404, detail="No bank transactions available to export.")
        
    members = db.query(Member).all()
    unit_map = {str(m.unit_no).strip(): str(m.new_owner) for m in members if m.unit_no}
    
    wb = openpyxl.Workbook()
    
    # SHEET 1
    ws1 = wb.active
    ws1.title = "Bank Statement"
    
    headers1 = [
        "Date",
        "Narration",
        "Chq./Ref.No.",
        "Value Dt",
        "Withdrawal Amt.",
        "Deposit Amt.",
        "Closing Balance",
        "Office/Shop No.",
        "Owner Name"
    ]
    ws1.append(headers1)
    
    for row in ws1.iter_rows(min_row=1, max_row=1):
        for cell in row:
            cell.font = Font(bold=True)
            
    ws1.freeze_panes = "A2"
    ws1.auto_filter.ref = f"A1:I{len(transactions) + 1 if len(transactions) > 0 else 1}"
    
    for tx in transactions:
        t_date = tx.transaction_date
        dt_val = t_date
        try:
            if t_date:
                dt_val = datetime.strptime(t_date, "%Y-%m-%d").date()
        except:
            pass
            
        ref_val = tx.reference_no or ""
        if not ref_val or ref_val.lower() == "nan":
            ref_match = re.search(r'\b(\d{12,16})\b', tx.narration or "")
            if ref_match:
                raw_ref = ref_match.group(1)
                ref_val = "0000" + raw_ref if len(raw_ref) == 12 else raw_ref

        withdrawal = tx.amount if tx.transaction_type == "DEBIT" else None
        deposit = tx.amount if tx.transaction_type == "CREDIT" else None
        unit_no = tx.matched_unit if tx.matched_unit else ""
        
        owner = tx.matched_owner if tx.matched_owner else ""
        if not owner and unit_no:
            units = [u.strip() for u in str(unit_no).split(",")]
            owners = []
            for u in units:
                if u in unit_map:
                    owners.append(unit_map[u])
            if owners:
                owner = ", ".join(owners)
                
        row_data = [
            dt_val,
            tx.narration,
            str(ref_val),
            dt_val, # Value Dt
            withdrawal,
            deposit,
            tx.closing_balance if tx.closing_balance is not None else None,
            unit_no,
            owner
        ]
        ws1.append(row_data)
        
    ws1.column_dimensions['A'].width = 14
    ws1.column_dimensions['B'].width = 55
    ws1.column_dimensions['C'].width = 22
    ws1.column_dimensions['D'].width = 14
    ws1.column_dimensions['E'].width = 16
    ws1.column_dimensions['F'].width = 16
    ws1.column_dimensions['G'].width = 16
    ws1.column_dimensions['H'].width = 18
    ws1.column_dimensions['I'].width = 32
    
    for row_idx in range(2, ws1.max_row + 1):
        ws1.cell(row=row_idx, column=1).number_format = 'DD/MM/YY'
        ws1.cell(row=row_idx, column=3).number_format = '@'
        ws1.cell(row=row_idx, column=4).number_format = 'DD/MM/YY'
        ws1.cell(row=row_idx, column=5).number_format = '#,##0.00'
        ws1.cell(row=row_idx, column=6).number_format = '#,##0.00'
        ws1.cell(row=row_idx, column=7).number_format = '#,##0.00'
        
    # SHEET 2
    ws2 = wb.create_sheet(title="Expense")
    headers2 = ["Voc No", "Date", "Drawn on", "Particulars", "Ref/Chq No", "Amount (₹)", "Narration"]
    ws2.append(headers2)
    
    for row in ws2.iter_rows(min_row=1, max_row=1):
        for cell in row:
            cell.font = Font(bold=True)
            
    ws2.freeze_panes = "A2"
    ws2.auto_filter.ref = f"A1:G{len(vouchers) + 1 if len(vouchers) > 0 else 1}"
    
    for v in vouchers:
        dt_val = v.expense_date
        try:
            if dt_val:
                dt_val = datetime.strptime(dt_val, "%Y-%m-%d").date()
        except:
            pass
            
        drawn_on, particulars, ref_no = extract_expense_details(v.narration, v.drawn_on, v.reference_no)
        drawn_on = v.drawn_on or drawn_on
        particulars = v.particulars or particulars
        ref_no = v.reference_no or ref_no

        row_data = [
            v.voucher_no,
            dt_val,
            drawn_on,
            particulars,
            str(ref_no),
            v.amount,
            v.narration if v.narration else ""
        ]
        ws2.append(row_data)
        
    ws2.column_dimensions['A'].width = 10
    ws2.column_dimensions['B'].width = 14
    ws2.column_dimensions['C'].width = 25
    ws2.column_dimensions['D'].width = 32
    ws2.column_dimensions['E'].width = 22
    ws2.column_dimensions['F'].width = 15
    ws2.column_dimensions['G'].width = 65
    
    for row_idx in range(2, ws2.max_row + 1):
        ws2.cell(row=row_idx, column=2).number_format = 'DD/MM/YY'
        ws2.cell(row=row_idx, column=5).number_format = '@'
        ws2.cell(row=row_idx, column=6).number_format = '#,##0.00'
        
    file_stream = io.BytesIO()
    wb.save(file_stream)
    file_stream.seek(0)
    
    headers = {
        'Content-Disposition': 'attachment; filename="Bank_Statement_Export.xlsx"'
    }
    
    return StreamingResponse(
        file_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )
