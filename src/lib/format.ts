export const TIMEZONE = "Africa/Nairobi";
export const LOCALE = "en-KE";

export function formatKES(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: TIMEZONE,
  }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIMEZONE,
  }).format(d);
}

/** Kenyan phone numbers: 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX. */
export const KE_PHONE_REGEX = /^(?:\+?254|0)(?:7\d{8}|1\d{8})$/;

export function normalizeKePhone(input: string): string {
  const v = input.replace(/[\s-]/g, "");
  if (v.startsWith("+254")) return v;
  if (v.startsWith("254")) return `+${v}`;
  if (v.startsWith("0")) return `+254${v.slice(1)}`;
  return v;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
