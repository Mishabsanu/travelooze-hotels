/**
 * Check-in / check-out times. All hotel times are India time (IST, UTC+5:30), wherever the server runs.
 * Shared by server and client.
 */

const IST_OFFSET_MS = 5.5 * 3600_000;

export const DEFAULT_CHECK_IN = "12:00";
export const DEFAULT_CHECK_OUT = "11:00";

/** "YYYY-MM-DDTHH:mm" for a moment, in IST (value for <input type="datetime-local">). */
export function toIstLocal(d: Date | string = new Date()): string {
  return new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** "HH:mm" in IST */
export function istTime(d: Date | string): string {
  return toIstLocal(d).slice(11, 16);
}

/** "YYYY-MM-DDTHH:mm" typed in IST → the real moment. */
export function parseIstLocal(value: string): Date {
  return new Date(`${value}:00.000+05:30`);
}

/** A stay day (stored as UTC midnight) plus an "HH:mm" IST time → the real moment. */
export function stayMoment(day: Date | string, time: string): Date {
  return parseIstLocal(`${new Date(day).toISOString().slice(0, 10)}T${time || "00:00"}`);
}

type StayLike = {
  checkIn: Date | string;
  checkOut: Date | string;
  checkedInAt?: Date | string | null;
  checkedOutAt?: Date | string | null;
  hotel?: { checkInTime?: string; checkOutTime?: string } | null;
};

/** Checked in before the hotel's standard check-in time on the arrival day. */
export function isEarlyCheckIn(b: StayLike): boolean {
  if (!b.checkedInAt) return false;
  return new Date(b.checkedInAt) < stayMoment(b.checkIn, b.hotel?.checkInTime || DEFAULT_CHECK_IN);
}

/** Checked out after the hotel's standard check-out time on the departure day. */
export function isLateCheckOut(b: StayLike): boolean {
  if (!b.checkedOutAt) return false;
  return new Date(b.checkedOutAt) > stayMoment(b.checkOut, b.hotel?.checkOutTime || DEFAULT_CHECK_OUT);
}

/** "2:30 PM" style label from "14:30" */
export function timeLabel(hhmm?: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
