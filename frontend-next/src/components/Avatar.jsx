"use client";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// Deterministic hue from the user id, so initials get a stable colour
function hueFor(id) {
  return (Number(id) * 137.508) % 360;
}

export function Avatar({ user, size = 32, ring = false, className = "" }) {
  if (!user) return null;

  const initial = (user.username || user.email || "?").trim()[0].toUpperCase();
  const hue = hueFor(user.id);
  const stamp = user.avatar_updated_at
    ? new Date(user.avatar_updated_at).getTime()
    : 0;

  const inner = user.has_avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${API_BASE}/api/users/${user.id}/avatar?v=${stamp}`}
      alt={user.username || "avatar"}
      width={size}
      height={size}
      className="w-full h-full object-cover"
    />
  ) : (
    <span
      className="w-full h-full flex items-center justify-center font-semibold text-white select-none"
      style={{
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${
          (hue + 48) % 360
        } 70% 42%))`,
      }}
    >
      {initial}
    </span>
  );

  const avatar = (
    <span
      className={`inline-block overflow-hidden rounded-full bg-surface-2 shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {inner}
    </span>
  );

  if (!ring) return avatar;

  // Pro users get a gradient ring
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        padding: Math.max(2, size * 0.07),
        background: "linear-gradient(135deg, #3b82f6, #6366f1, #a855f7)",
      }}
    >
      {avatar}
    </span>
  );
}

export default Avatar;
