export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  // Always India time, even on a UTC server (Vercel)
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function formatNumber(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "0";
  return value.toLocaleString("en-US");
}

export function initials(name?: string): string {
  if (!name) return "HM";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "HM";
}

/** Indian rupees, e.g. ₹12,345.00 */
export function formatINR(value?: number | null): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}

/** Stay dates are stored as UTC midnight: format them in UTC so they never shift a day. */
export function formatDay(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "2026-11-09" for <input type="date"> */
export const toDayString = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 Adults", "2 Adults + 1 Child" (never "2A 1C") */
export function paxLabel(adults: number, children = 0): string {
  return children ? `${plural(adults, "Adult", "Adults")} + ${plural(children, "Child", "Children")}` : plural(adults, "Adult", "Adults");
}

/** Room type capacity: "2 Adults + 2 Children + 1 Extra Bed" */
export function capacityLabel(maxAdults: number, maxChildren = 2, maxExtraBeds = 1): string {
  return [plural(maxAdults, "Adult", "Adults"), maxChildren ? plural(maxChildren, "Child", "Children") : "", maxExtraBeds ? plural(maxExtraBeds, "Extra Bed", "Extra Beds") : ""]
    .filter(Boolean)
    .join(" + ");
}
