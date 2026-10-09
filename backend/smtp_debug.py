import os
import smtplib
import ssl

from dotenv import load_dotenv

load_dotenv()

host = os.getenv("SMTP_HOST", "smtp.gmail.com")
port = int(os.getenv("SMTP_PORT", 587))
user = os.getenv("SMTP_USER")
pw = (os.getenv("SMTP_PASSWORD") or "").replace(" ", "")

s = smtplib.SMTP(host, port, timeout=20)
s.set_debuglevel(1)          # show the handshake
try:
    s.ehlo()
    s.starttls(context=ssl.create_default_context())
    s.ehlo()
    s.set_debuglevel(0)      # hide the AUTH line - it encodes the password
    s.login(user, pw)
    print("\nLOGIN OK")
    s.quit()
except Exception as e:
    print(f"\ndied at: {type(e).__name__}: {e}")