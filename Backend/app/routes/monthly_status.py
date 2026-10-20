import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bank_transaction import BankTransaction
from app.models.member import Member


router = APIRouter(
    prefix="/bank",
    tags=["Monthly Payment Status"]
)


def normalize(value):
    return re.sub(r"[^A-Z0-9]", "", str(value or "").upper())

def owner_matches(member_owner, transaction_owner, narration=None):
    if not member_owner:
        return False

    member_tokens = set(
        normalize(member_owner).split()
    )

    if not member_tokens:
        return False

    transaction_text = normalize(
        f"{transaction_owner or ''} {narration or ''}"
    )

    # Require at least 2 meaningful owner-name tokens
    # to reduce false matches.
    meaningful_tokens = [
        token
        for token in member_tokens
        if len(token) >= 5
    ]

    if len(meaningful_tokens) >= 2:
        matched_tokens = [
            token
            for token in meaningful_tokens
            if token in transaction_text
        ]

        return len(matched_tokens) >= 2

    return any(
        token in transaction_text
        for token in meaningful_tokens
    )
def get_month_from_date(value):
    try:
        return datetime.strptime(str(value), "%d-%m-%Y").strftime("%Y-%m")
    except Exception:
        pass

    try:
        return datetime.strptime(str(value), "%Y-%m-%d").strftime("%Y-%m")
    except Exception:
        pass

    try:
        return datetime.fromisoformat(str(value)).strftime("%Y-%m")
    except Exception:
        return None


def unit_matches(member_unit, transaction_unit):
    if not member_unit or not transaction_unit:
        return False

    member_unit = normalize(member_unit)

    # Handle values such as:
    # "201,202,209,210,211"
    transaction_units = re.split(
        r"[,/;&\s]+",
        str(transaction_unit)
    )

    return any(
        member_unit == normalize(unit)
        for unit in transaction_units
        if unit
    )


def owner_matches(member_owner, transaction_owner):
    if not member_owner or not transaction_owner:
        return False

    member_tokens = set(
        normalize(member_owner).split()
    )

    transaction_text = normalize(transaction_owner)

    if not member_tokens:
        return False

    return any(
        len(token) >= 5 and token in transaction_text
        for token in member_tokens
    )


def get_latest_statement_month(db):
    transactions = (
        db.query(BankTransaction)
        .filter(BankTransaction.status == "MAINTENANCE")
        .all()
    )

    months = []

    for tx in transactions:
        month = get_month_from_date(tx.transaction_date)

        if month:
            months.append(month)

    return max(months) if months else None

@router.get("/monthly-status/verify")
def verify_monthly_status(
    month: str = Query(..., description="Month in YYYY-MM format"),
    db: Session = Depends(get_db)
):
    if not re.match(r"^\d{4}-\d{2}$", month):
        raise HTTPException(
            status_code=400,
            detail="Month must be in YYYY-MM format"
        )

    # Get maintenance transactions for this statement month
    transactions = db.query(BankTransaction).filter(
        BankTransaction.status == "MAINTENANCE"
    ).all()

    month_transactions = [
        tx for tx in transactions
        if get_month_from_date(tx.transaction_date) == month
    ]

    # Check ALL members
    members = db.query(Member).all()

    paid = []
    unpaid = []

    for member in members:

        matched_transaction = None
        matched_by = None

        # 1. Check unit
        for tx in month_transactions:
            if unit_matches(member.unit_no, tx.matched_unit):
                matched_transaction = tx
                matched_by = "unit"
                break

        # 2. Check owner
        if not matched_transaction:
            for tx in month_transactions:
                if owner_matches(
                    member.new_owner,
                    tx.matched_owner
                ):
                    matched_transaction = tx
                    matched_by = "owner"
                    break

        if matched_transaction:
            paid.append({
                "member_id": member.id,
                "unit_no": member.unit_no,
                "owner_name": member.new_owner,
                "matched_by": matched_by,
                "transaction_id": matched_transaction.id,
                "amount": matched_transaction.amount,
                "payment_date": matched_transaction.transaction_date
            })
        else:
            unpaid.append({
                "member_id": member.id,
                "unit_no": member.unit_no,
                "owner_name": member.new_owner,
                "email": member.email,
                "mobile": member.mobile,
                "reminder_required": True
            })

    return {
        "success": True,
        "statement_month": month,
        "total_members": len(members),
        "paid_count": len(paid),
        "unpaid_count": len(unpaid),
        "verification_passed": True,
        "paid": paid,
        "unpaid": unpaid
    }
@router.get("/monthly-status")
def get_monthly_status(
    month: str | None = Query(
        default=None,
        description="Statement month in YYYY-MM format"
    ),
    db: Session = Depends(get_db)
):
    # If month is not provided, use latest uploaded statement month
    if not month:
        month = get_latest_statement_month(db)

    if not month:
        raise HTTPException(
            status_code=404,
            detail="No maintenance bank statement found."
        )

    if not re.match(r"^\d{4}-\d{2}$", month):
        raise HTTPException(
            status_code=400,
            detail="Month must be in YYYY-MM format."
        )

    transactions = (
        db.query(BankTransaction)
        .filter(BankTransaction.status == "MAINTENANCE")
        .all()
    )

    month_transactions = [
        tx
        for tx in transactions
        if get_month_from_date(tx.transaction_date) == month
    ]

    members = (
    db.query(Member)
    .all()
)

    result = []

    for member in members:

        matched_transaction = None
        matched_by = None

        for tx in month_transactions:

            # Match by unit number
            if unit_matches(
                member.unit_no,
                tx.matched_unit
            ):
                matched_transaction = tx
                matched_by = "unit"
                break

            # Match by owner name
            if owner_matches(
                member.new_owner,
                tx.matched_owner
            ):
                matched_transaction = tx
                matched_by = "owner"
                break

        if matched_transaction:

            result.append({
                "member_id": member.id,
                "unit_no": member.unit_no,
                "unit_type": member.unit_type,
                "owner_name": member.new_owner or member.old_owner,
                "email": member.email,
                "mobile": member.mobile,

                "status": "PAID",
                "matched_by": matched_by,

                "paid_amount": matched_transaction.amount,
                "payment_date": matched_transaction.transaction_date,
                "transaction_id": matched_transaction.id,
                "reference_no": matched_transaction.reference_no,
                "narration": matched_transaction.narration,

                "reminder_required": False
            })

        else:

            result.append({
                "member_id": member.id,
                "unit_no": member.unit_no,
                "unit_type": member.unit_type,
                "owner_name": member.new_owner or member.old_owner,
                "email": member.email,
                "mobile": member.mobile,

                "status": "UNPAID",
                "matched_by": None,

                "paid_amount": 0,
                "payment_date": None,
                "transaction_id": None,
                "reference_no": None,
                "narration": None,

                "reminder_required": True
            })

    paid_count = sum(
        1 for item in result
        if item["status"] == "PAID"
    )

    unpaid_count = sum(
        1 for item in result
        if item["status"] == "UNPAID"
    )

    return {
        "success": True,
        "statement_month": month,

        "total_members": len(result),
        "paid_count": paid_count,
        "unpaid_count": unpaid_count,

        "maintenance_transactions": len(month_transactions),

        "reminder_count": unpaid_count,

        "data": result
    }
    
    