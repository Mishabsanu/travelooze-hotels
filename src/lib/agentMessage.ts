/**
 * Reads a booking request as agents send it on WhatsApp, e.g.
 *
 *   SL NO: B2295 HN
 *   GUEST NAME: OH MY DAYS - UV
 *   NO OF MEMBERS: 49 + 2
 *   HOTEL NAME: HOTEL SUMEERA INN
 *   CHECK IN: NOV 23        CHECK OUT: NOV 24
 *   ROOMING: 14 ROOMS ON QUAD SHARING
 *   MEAL PLAN: MAP
 *   PER HEAD : 450 for 49 pax
 *
 * Pure and forgiving: whatever it cannot read is simply left out, so staff fill it by hand.
 */
import { MEAL_PLAN_CODES, type MealPlan } from "./constants";

export interface AgentMessage {
  agentRef?: string;
  guestName?: string;
  /** Paying guests ("49" in "49 + 2") */
  pax?: number;
  /** Complimentary guests ("2" in "49 + 2": tour leader, driver) */
  focPax?: number;
  hotelName?: string;
  location?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  rooms?: number;
  /** People per room: 2 double, 3 triple, 4 quad */
  perRoom?: number;
  mealPlan?: MealPlan;
  perHead?: number;
  phone?: string;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const SHARING: Record<string, number> = { single: 1, double: 2, twin: 2, triple: 3, tripple: 3, quad: 4, quadruple: 4, quard: 4, five: 5, penta: 5, six: 6 };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const validDay = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** "NOV 23", "23 Nov", "23rd November 2026", "23/11", "23-11-26", "2026-11-23" → YYYY-MM-DD (next such date when no year). */
export function parseLooseDate(text: string, today: string): string | undefined {
  const s = text.toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1").replace(/[,.]/g, " ");
  let y: number | undefined, m: number | undefined, d: number | undefined;
  let hit = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (hit) [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  if (!m && (hit = s.match(/\b(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{2,4}))?\b/))) {
    [d, m] = [Number(hit[1]), Number(hit[2])];
    if (hit[3]) y = hit[3].length === 2 ? 2000 + Number(hit[3]) : Number(hit[3]);
  }
  if (!m) {
    const mon = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
    if (mon) {
      m = MONTHS.indexOf(mon[1]) + 1;
      const rest = s.replace(mon[0], " ");
      const day = rest.match(/\b(\d{1,2})\b/);
      const year = rest.match(/\b(\d{4})\b/);
      if (day) d = Number(day[1]);
      if (year) y = Number(year[1]);
    }
  }
  if (!m || !d) return undefined;
  if (!y) {
    // No year: the next time that day comes round (today counts)
    y = Number(today.slice(0, 4));
    if (validDay(y, m, d) && iso(y, m, d) < today) y += 1;
  }
  return validDay(y, m, d) ? iso(y, m, d) : undefined;
}

const firstInt = (v: string) => {
  const m = v.match(/\d+/);
  return m ? Number(m[0]) : undefined;
};

export function parseAgentMessage(text: string, today: string): AgentMessage {
  // "KEY: value" pairs; lines without a colon continue the previous value (WhatsApp wraps long lines)
  const pairs: [string, string][] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[*_~]/g, "").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z .()/#'-]{2,30}?)\s*[:=\-–]\s*(.*)$/);
    if (m && /[a-z]/i.test(m[1])) pairs.push([m[1].toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim(), m[2].trim()]);
    else if (pairs.length) pairs[pairs.length - 1][1] += ` ${line}`;
  }

  const out: AgentMessage = {};
  let perHeadPax: number | undefined;
  for (const [key, value] of pairs) {
    if (!value) continue;
    if (/check ?in|arrival|\bcin\b|from date/.test(key)) out.checkIn = parseLooseDate(value, today) ?? out.checkIn;
    else if (/check ?out|departure|\bcout\b|to date/.test(key)) out.checkOut = parseLooseDate(value, today) ?? out.checkOut;
    else if (/night/.test(key)) out.nights = firstInt(value);
    else if (/hotel/.test(key)) out.hotelName = value;
    else if (/location|place|destination|city/.test(key)) out.location = value;
    else if (/per ?head|per ?pax|per ?person|\brate\b|tariff|price/.test(key)) {
      const nums = value.replace(/,/g, "").match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
      if (nums[0]) out.perHead = nums[0];
      const forPax = value.match(/for\s*(\d+)/i);
      if (forPax) perHeadPax = Number(forPax[1]);
    } else if (/room/.test(key)) {
      out.rooms = firstInt(value);
      const v = value.toLowerCase();
      const word = Object.keys(SHARING).find((w) => new RegExp(`\\b${w}`).test(v));
      const num = v.match(/(\d+)\s*(?:pax\s*)?(?:per room|sharing|share)/);
      out.perRoom = word ? SHARING[word] : num && Number(num[1]) !== out.rooms ? Number(num[1]) : out.perRoom;
    } else if (/meal|plan|food/.test(key)) {
      const v = value.toUpperCase();
      out.mealPlan = (["MAP", "CP", "EP", "AP"] as const).find((c) => new RegExp(`\\b${c}\\b`).test(v) && MEAL_PLAN_CODES.includes(c));
    } else if (/member|pax|guests|persons|people|adults|group size|no of/.test(key)) {
      const nums = value.match(/\d+/g)?.map(Number) ?? [];
      if (nums.length) {
        out.pax = nums[0];
        if (nums.length > 1 && /\+/.test(value)) out.focPax = nums.slice(1).reduce((a, b) => a + b, 0);
      }
    } else if (/phone|mobile|contact|cell|whatsapp/.test(key)) {
      const p = value.match(/\+?\d[\d\s-]{6,18}\d/);
      if (p) out.phone = p[0].replace(/[\s-]/g, "");
    } else if (/sl|ref|voucher|booking id|booking no|file|conf/.test(key)) out.agentRef = value.slice(0, 60);
    else if (/name|group|guest|party/.test(key)) out.guestName = value.slice(0, 100);
  }

  // "450 for 49 pax" says who pays: everyone above that number is complimentary
  if (perHeadPax && out.pax && out.focPax === undefined && perHeadPax < out.pax) out.focPax = out.pax - perHeadPax;
  if (!out.checkOut && out.checkIn && out.nights) {
    out.checkOut = new Date(new Date(`${out.checkIn}T00:00:00Z`).getTime() + out.nights * 86_400_000).toISOString().slice(0, 10);
  }
  // "DEC 31 → JAN 1": the check-out belongs to the next year
  if (out.checkIn && out.checkOut && out.checkOut <= out.checkIn) {
    const next = `${Number(out.checkOut.slice(0, 4)) + 1}${out.checkOut.slice(4)}`;
    out.checkOut = next > out.checkIn ? next : undefined;
  }
  return out;
}

/** Best hotel option for a name like "HOTEL SUMEERA INN". */
export function matchHotel<T extends { value: string; label: string }>(name: string | undefined, options: T[]): T | undefined {
  if (!name) return undefined;
  const norm = (s: string) => s.toLowerCase().replace(/\b(hotel|resort|the|and|&)\b/g, " ").replace(/[^a-z0-9]/g, "");
  const n = norm(name);
  if (!n) return undefined;
  return options.find((o) => norm(o.label) === n) ?? options.find((o) => norm(o.label).includes(n) || n.includes(norm(o.label)));
}
