import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

TEST_TO = "kartiksdudeja@gmail.com"

msg = EmailMessage()
msg["Subject"] = "Icon Tower - Email Test"
msg["From"] = SMTP_USER
msg["To"] = TEST_TO

msg.set_content(
    """Hello,

This is a test email from the Icon Tower Society Maintenance System.

If you received this email, the SMTP configuration is working correctly.

Regards,
Society Management
"""
)

try:
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)

    print("EMAIL SENT SUCCESSFULLY")

except Exception as e:
    print("EMAIL FAILED")
    print(type(e).__name__, str(e))