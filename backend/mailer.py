import os
import smtplib
import ssl
from email.message import EmailMessage


def send_notification(subject: str, body: str, html: str | None = None) -> bool:
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", 465))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    to_addr = os.getenv("NOTIFY_EMAIL") or user

    if not (user and password and to_addr):
        print("[email] SMTP not configured - skipping notification")
        return False

    # App passwords are often pasted with the spaces Google displays.
    password = password.replace(" ", "")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = user
    msg["To"] = to_addr
    msg.set_content(body)       
    if html:
        msg.add_alternative(html, subtype="html")
    if html:
        msg.add_alternative(html, subtype="html")

    context = ssl.create_default_context()

    # 465 is implicit TLS; 587 starts plain and upgrades. Using the wrong one
    # for the port looks like "connection unexpectedly closed", which is why
    # this picks by port instead of assuming.
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(user, password)
                server.send_message(msg)
        print(f"[email] sent to {to_addr}")
        return True
    except smtplib.SMTPAuthenticationError as e:
        print(f"[email] login rejected for {user}: {e.smtp_code} {e.smtp_error}")
        print("[email] the app password must belong to the SMTP_USER account")
        return False
    except Exception as e:
        print(f"[email] failed via {host}:{port}: {type(e).__name__}: {e}")
        return False