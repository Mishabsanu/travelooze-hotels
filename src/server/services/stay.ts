import "server-only";
import { AppError } from "../http/errors";

const DAY = 86_400_000;

/** "2026-11-09" -> Date at UTC midnight (all stay dates are stored this way). */
export function parseDay(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new AppError("Invalid date", 422);
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new AppError("Invalid date", 422);
  return d;
}

/** Today in India (IST) as a UTC-midnight Date. */
export function todayIST(): Date {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  return new Date(`${ist.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

export const nightsBetween = (checkIn: Date, checkOut: Date) => Math.round((checkOut.getTime() - checkIn.getTime()) / DAY);

export function eachNight(checkIn: Date, checkOut: Date): Date[] {
  const out: Date[] = [];
  for (let t = checkIn.getTime(); t < checkOut.getTime(); t += DAY) out.push(new Date(t));
  return out;
}
