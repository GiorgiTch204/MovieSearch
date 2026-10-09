import os
import smtplib
import ssl
from email.message import EmailMessage


def send_notification(subject: str, body: str) -> bool:
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", 465))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    to_addr = os.getenv("NOTIFY_EMAIL") or user

    if not (user and password and to_addr):
        print("[email] SMTP not configured - skipping notification")
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = user
    msg["To"] = to_addr
    msg.set_content(body)

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=context, timeout=10) as server:
            server.login(user, password)
            server.send_message(msg)
        print(f"[email] sent to {to_addr}")
        return True
    except Exception as e:
        print(f"[email] failed: {type(e).__name__}: {e}")
        return False