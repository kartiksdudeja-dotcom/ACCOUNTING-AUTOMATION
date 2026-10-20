import os
import re
import smtplib

from email.message import EmailMessage
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bank_transaction import BankTransaction
from app.models.member import Member


router = APIRouter(
    prefix="/reminders",
    tags=["Reminders"]
)


class ReminderRequest(BaseModel):
    month: str
    member_ids: list[int]
    channel: str = "email"
    messages: dict[int, str] = Field(default_factory=dict)


def normalize(value):
    return re.sub(
        r"[^A-Z0-9]",
        "",
        str(value or "").upper()
    )


def get_month_from_date(value):
    try:
        return datetime.strptime(
            str(value),
            "%d-%m-%Y"
        ).strftime("%Y-%m")
    except Exception:
        pass

    try:
        return datetime.strptime(
            str(value),
            "%Y-%m-%d"
        ).strftime("%Y-%m")
    except Exception:
        pass

    try:
        return datetime.fromisoformat(
            str(value)
        ).strftime("%Y-%m")
    except Exception:
        return None


def member_is_paid(member, month, db):

    transactions = (
        db.query(BankTransaction)
        .filter(
            BankTransaction.status == "MAINTENANCE"
        )
        .all()
    )

    for tx in transactions:

        if get_month_from_date(
            tx.transaction_date
        ) != month:
            continue

        # Unit match
        if (
            member.unit_no
            and tx.matched_unit
            and normalize(member.unit_no)
            == normalize(tx.matched_unit)
        ):
            return True

        # Owner match
        member_owner = normalize(
            member.new_owner
        )

        transaction_owner = normalize(
            tx.matched_owner
        )

        if (
            member_owner
            and transaction_owner
            and member_owner in transaction_owner
        ):
            return True

    return False


def send_email(member, month, custom_message=None):

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(
        os.getenv("SMTP_PORT", "587")
    )
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not smtp_host:
        raise Exception("SMTP_HOST is missing")

    if not smtp_user:
        raise Exception("SMTP_USER is missing")

    if not smtp_password:
        raise Exception("SMTP_PASSWORD is missing")

    if not member.email:
        raise Exception("Member email is missing")

    owner_name = (
        member.new_owner
        or member.old_owner
        or "Member"
    )

    message = EmailMessage()

    message["Subject"] = (
        f"Maintenance Payment Reminder - "
        f"Unit {member.unit_no} - {month}"
    )

    message["From"] = smtp_user
    message["To"] = member.email

    message_text = custom_message or f"""Dear {owner_name},

This is a reminder that the maintenance payment for unit {member.unit_no} for {month} has not been found in the uploaded bank statement.

Kindly make the maintenance payment at the earliest.

If you have already made the payment, please share the payment details with the society management.

Regards,
Icon Tower Society Management
"""
    message.set_content(
        message_text.replace("{owner_name}", owner_name)
        .replace("{unit_no}", str(member.unit_no or ""))
        .replace("{month}", month)
    )

    with smtplib.SMTP(
        smtp_host,
        smtp_port
    ) as server:

        server.starttls()

        server.login(
            smtp_user,
            smtp_password
        )

        server.send_message(message)


@router.post("/send-email")
def send_email_reminders(
    request: ReminderRequest,
    db: Session = Depends(get_db)
):

    if not request.member_ids:
        raise HTTPException(
            status_code=400,
            detail="No members selected."
        )

    results = []

    for member_id in request.member_ids:

        member = (
            db.query(Member)
            .filter(Member.id == member_id)
            .first()
        )

        if not member:
            results.append({
                "member_id": member_id,
                "status": "FAILED",
                "message": "Member not found"
            })
            continue

        # IMPORTANT:
        # Check bank statement again before sending.
        if member_is_paid(
            member,
            request.month,
            db
        ):
            results.append({
                "member_id": member.id,
                "unit_no": member.unit_no,
                "status": "SKIPPED",
                "message": "Member is already PAID"
            })
            continue

        if not member.email:
            results.append({
                "member_id": member.id,
                "unit_no": member.unit_no,
                "status": "FAILED",
                "message": "Email address not available"
            })
            continue

        try:

            send_email(
                member,
                request.month,
                request.messages.get(member.id)
            )

            results.append({
                "member_id": member.id,
                "unit_no": member.unit_no,
                "email": member.email,
                "status": "SENT",
                "message": "Email sent successfully"
            })

        except Exception as e:

            results.append({
                "member_id": member.id,
                "unit_no": member.unit_no,
                "email": member.email,
                "status": "FAILED",
                "message": str(e)
            })

    return {
        "success": True,
        "month": request.month,
        "results": results
    }
