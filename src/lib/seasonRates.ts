/**
 * Seasonal pricing of a room type, shared by the server (authoritative) and the screens (live prices).
 * A season overrides the normal rate for the nights inside it; a rate left at 0 in a season
 * means "use the normal rate" for that meal plan. A stay crossing seasons gets the average
 * nightly rate, so every booking still stores one rate per room.
 */
import { MEAL_PLAN_CODES, type MealPlan } from "./constants";

export type PlanRates = Record<MealPlan, number>;

export interface Season {
  _id?: string;
  name: string;
  /** First and last night of the season, YYYY-MM-DD (inclusive) */
  from: string;
  to: string;
  /** Same dates every year (e.g. 20 Dec – 5 Jan), the year is ignored */
  yearly?: boolean;
  rates: PlanRates;
  extraBedRates?: PlanRates;
}

export interface Priced {
  rates: PlanRates;
  extraBedRates?: PlanRates;
  seasons?: Omit<Season, "_id">[];
}

/** Does the night `day` (YYYY-MM-DD) fall inside the season? */
export function inSeason(s: Omit<Season, "_id">, day: string): boolean {
  if (!s.from || !s.to) return false;
  if (!s.yearly) return s.from <= day && day <= s.to;
  const md = day.slice(5);
  const a = s.from.slice(5);
  const b = s.to.slice(5);
  return a <= b ? a <= md && md <= b : md >= a || md <= b; // wraps over New Year
}

export function seasonOn(t: Priced, day: string): Omit<Season, "_id"> | undefined {
  return (t.seasons ?? []).find((s) => inSeason(s, day));
}

const nightsOf = (checkIn: string, checkOut: string) => {
  const out: string[] = [];
  for (let d = Date.parse(`${checkIn}T00:00:00Z`); d < Date.parse(`${checkOut}T00:00:00Z`); d += 86_400_000) {
    out.push(new Date(d).toISOString().slice(0, 10));
  }
  return out;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Room and extra-bed rates per meal plan for a stay: the average of each night's rate
 * (season rate on season nights, normal rate otherwise), plus the names of the seasons it touches.
 */
export function stayRates(t: Priced, checkIn: string, checkOut: string): { rates: PlanRates; extraBedRates: PlanRates; seasons: string[] } {
  const normalBeds = t.extraBedRates ?? { EP: 0, CP: 0, MAP: 0, AP: 0 };
  const nights = nightsOf(checkIn, checkOut);
  if (!t.seasons?.length || !nights.length) return { rates: { ...t.rates }, extraBedRates: { ...normalBeds }, seasons: [] };
  const names = new Set<string>();
  const sum = { rates: { EP: 0, CP: 0, MAP: 0, AP: 0 } as PlanRates, beds: { EP: 0, CP: 0, MAP: 0, AP: 0 } as PlanRates };
  for (const day of nights) {
    const s = seasonOn(t, day);
    if (s) names.add(s.name);
    for (const c of MEAL_PLAN_CODES) {
      sum.rates[c] += (s?.rates?.[c] || 0) || (t.rates?.[c] ?? 0);
      sum.beds[c] += (s?.extraBedRates?.[c] || 0) || (normalBeds[c] ?? 0);
    }
  }
  const n = nights.length;
  const rates = Object.fromEntries(MEAL_PLAN_CODES.map((c) => [c, r2(sum.rates[c] / n)])) as PlanRates;
  const extraBedRates = Object.fromEntries(MEAL_PLAN_CODES.map((c) => [c, r2(sum.beds[c] / n)])) as PlanRates;
  return { rates, extraBedRates, seasons: [...names] };
}

/** Two seasons of one room type that share a night (the first would silently win), or null. */
export function overlappingSeasons(seasons: Pick<Season, "name" | "from" | "to" | "yearly">[]): [string, string] | null {
  const days = (s: Pick<Season, "from" | "to" | "yearly">) => {
    if (!s.from || !s.to) return [] as string[];
    // Yearly seasons are compared on a leap year so 29 Feb counts
    const from = s.yearly ? `2024${s.from.slice(4)}` : s.from;
    let to = s.yearly ? `2024${s.to.slice(4)}` : s.to;
    if (s.yearly && to < from) to = `2025${s.to.slice(4)}`;
    return nightsOf(from, nextDay(to)).map((d) => (s.yearly ? d.slice(5) : d));
  };
  for (let i = 0; i < seasons.length; i++) {
    for (let j = i + 1; j < seasons.length; j++) {
      const a = seasons[i];
      const b = seasons[j];
      if (a.yearly || b.yearly) {
        const set = new Set(days(a).map((d) => d.slice(-5)));
        if (days(b).some((d) => set.has(d.slice(-5)))) return [a.name, b.name];
      } else if (a.from <= b.to && b.from <= a.to) return [a.name, b.name];
    }
  }
  return null;
}

function nextDay(day: string) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}
