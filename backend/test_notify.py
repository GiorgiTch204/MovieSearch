import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time

from dotenv import load_dotenv

load_dotenv()


def mask(v):
    if not v:
        return "*** NOT SET ***"
    return f"{v[:6]}...{v[-4:]}  (len {len(v)})"


print("env as the app sees it")
print("-" * 46)
print(f"  TELEGRAM_BOT_TOKEN : {mask(os.getenv('TELEGRAM_BOT_TOKEN'))}")
print(f"  TELEGRAM_CHAT_ID   : {os.getenv('TELEGRAM_CHAT_ID') or '*** NOT SET ***'}")
print(f"  NOTIFY_EMAIL       : {os.getenv('NOTIFY_EMAIL') or '*** NOT SET ***'}")
print(f"  SMTP_USER          : {os.getenv('SMTP_USER') or '*** NOT SET ***'}")
print(f"  SMTP_PASSWORD      : {mask(os.getenv('SMTP_PASSWORD'))}")
print()

from backend.notify import notify

print("sending...")
notify(subject="MovieSearch notify test", body="If you can read this, the module works.")
time.sleep(12)  # the send runs on a daemon thread; give it time to finish
print("\ndone -- any [telegram] / [email] lines above are the real result")