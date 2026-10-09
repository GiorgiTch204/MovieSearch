import html as _html
import os
import threading
import urllib.parse
import urllib.request

from backend.mailer import send_notification

ADMIN_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/") + "/admin"


def build_html(title, subtitle, rows, accent):
    cells = ""
    for label, value in rows:
        cells += f"""
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #e9eef5;font:400 13px/1.4 Helvetica,Arial,sans-serif;color:#64748b;white-space:nowrap;vertical-align:top;">{_html.escape(str(label))}</td>
                <td style="padding:10px 0 10px 20px;border-bottom:1px solid #e9eef5;font:600 14px/1.4 Helvetica,Arial,sans-serif;color:#0f172a;text-align:right;word-break:break-word;">{_html.escape(str(value))}</td>
              </tr>"""

    return f"""<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08);">

        <tr><td style="background:{accent};padding:22px 28px;">
          <div style="font:700 17px/1.3 Helvetica,Arial,sans-serif;color:#ffffff;">&#127916; MovieSearch Pro</div>
          <div style="font:400 12px/1.4 Helvetica,Arial,sans-serif;color:rgba(255,255,255,.82);padding-top:3px;">{_html.escape(subtitle)}</div>
        </td></tr>

        <tr><td style="padding:26px 28px 6px 28px;">
          <div style="font:700 19px/1.3 Helvetica,Arial,sans-serif;color:#0f172a;">{_html.escape(title)}</div>
        </td></tr>

        <tr><td style="padding:10px 28px 24px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{cells}
          </table>
        </td></tr>

        <tr><td style="padding:0 28px 26px 28px;">
          <a href="{_html.escape(ADMIN_URL)}" style="display:inline-block;background:{accent};color:#ffffff;text-decoration:none;font:600 13px/1 Helvetica,Arial,sans-serif;padding:12px 20px;border-radius:9px;">Open the admin dashboard</a>
        </td></tr>

        <tr><td style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e9eef5;font:400 11px/1.5 Helvetica,Arial,sans-serif;color:#94a3b8;">
          Automatic notification from MovieSearch Pro.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


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


def _deliver(subject, body, html):
    try:
        send_notification(subject=subject, body=body, html=html)
    except Exception as e:
        print(f"[notify] email raised: {type(e).__name__}: {e}")
    try:
        _send_telegram(f"{subject}\n\n{body}")
    except Exception as e:
        print(f"[notify] telegram raised: {type(e).__name__}: {e}")


def notify(subject, body, title=None, subtitle="Account activity",
           rows=None, accent="#2563eb"):
    html = build_html(title or subject, subtitle, rows, accent) if rows else None
    threading.Thread(target=_deliver, args=(subject, body, html), daemon=True).start()