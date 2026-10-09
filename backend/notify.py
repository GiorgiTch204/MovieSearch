import os
import threading
import urllib.parse
import urllib.request

from backend.mailer import send_notification


def _send_telegram(text: str) -> bool:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not (token and chat_id):
        return False
    try:
        data = urllib.parse.urlencode({"chat_id": chat_id, "text": text}).encode()
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage", data=data
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            ok = 200 <= resp.status < 300
        print(f"[telegram] {'sent' if ok else 'failed'}")
        return ok
    except Exception as e:
        print(f"[telegram] failed: {type(e).__name__}: {e}")
        return False


def _deliver(subject: str, body: str) -> None:
    try:
        send_notification(subject=subject, body=body)
    except Exception as e:
        print(f"[notify] email raised: {type(e).__name__}: {e}")
    try:
        _send_telegram(f"{subject}\n\n{body}")
    except Exception as e:
        print(f"[notify] telegram raised: {type(e).__name__}: {e}")


def notify(subject: str, body: str) -> None:
    """Returns immediately. Delivery happens on a background thread."""
    threading.Thread(target=_deliver, args=(subject, body), daemon=True).start()