/**
 * GST tax invoice figures for a booking (pure: used by the invoice page, prints identically everywhere).
 * Hotel accommodation is taxed where the property is (place of supply = hotel's state), so the tax is
 * always split into CGST + SGST.
 */
import { CHARGE_CATEGORIES, MEAL_PLANS, SAC_ACCOMMODATION, gstRateFor } from "./constants";
import type { Booking } from "./hotelTypes";
import { round2 } from "./pricing";

export interface InvoiceLine {
  description: string;
  sac: string;
  qty: string;
  rate: number;
  taxable: number;
  gstPercent: number;
  cgst: number;
  sgst: number;
  total: number;
}

export interface InvoiceFigures {
  lines: InvoiceLine[];
  taxable: number;
  cgst: number;
  sgst: number;
  total: number;
  paid: number;
  balance: number;
  words: string;
  /** GST % → taxable and tax, for the tax summary table */
  byRate: { rate: number; taxable: number; cgst: number; sgst: number }[];
}

function line(description: string, sac: string, qty: string, rate: number, taxable: number, gstPercent: number): InvoiceLine {
  const tax = round2((taxable * gstPercent) / 100);
  const cgst = round2(tax / 2);
  const sgst = round2(tax - cgst);
  return { description, sac, qty, rate: round2(rate), taxable: round2(taxable), gstPercent, cgst, sgst, total: round2(taxable + tax) };
}

export function buildInvoice(b: Booking): InvoiceFigures {
  const base = b.roomCharges + (b.extraBedCharges ?? 0);
  const discPct = base ? b.discount / base : 0;
  const plan = MEAL_PLANS[b.mealPlan]?.label ?? b.mealPlan;
  const lines: InvoiceLine[] = [];

  for (const r of b.rooms) {
    const perNight = r.ratePerNight + (r.extraBeds ?? 0) * (r.extraBedRate ?? 0);
    const net = round2(perNight * (1 - discPct));
    const beds = r.extraBeds ? ` + ${r.extraBeds} extra bed` : "";
    lines.push(
      line(
        `Room ${r.roomNumber} – ${r.roomTypeName}${beds} (${plan})`,
        SAC_ACCOMMODATION,
        `${b.nights} night${b.nights > 1 ? "s" : ""}`,
        net,
        net * b.nights,
        gstRateFor(net)
      )
    );
  }
  for (const c of b.charges ?? []) {
    const cat = CHARGE_CATEGORIES[c.category];
    lines.push(line(c.description || cat.label, cat.sac, String(c.qty), c.rate, c.amount, c.gstPercent));
  }

  const sum = (k: "taxable" | "cgst" | "sgst" | "total") => round2(lines.reduce((s, l) => s + l[k], 0));
  const rates = new Map<number, { rate: number; taxable: number; cgst: number; sgst: number }>();
  for (const l of lines) {
    const r = rates.get(l.gstPercent) ?? { rate: l.gstPercent, taxable: 0, cgst: 0, sgst: 0 };
    r.taxable = round2(r.taxable + l.taxable);
    r.cgst = round2(r.cgst + l.cgst);
    r.sgst = round2(r.sgst + l.sgst);
    rates.set(l.gstPercent, r);
  }
  const total = sum("total");
  return {
    lines,
    taxable: sum("taxable"),
    cgst: sum("cgst"),
    sgst: sum("sgst"),
    total,
    paid: b.paid,
    balance: round2(total - b.paid),
    words: rupeesInWords(total),
    byRate: [...rates.values()].sort((a, c) => a.rate - c.rate),
  };
}

/** Financial year label (April–March) for a date in India, e.g. "2026-27". */
export function financialYear(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** GST state code (first 2 digits of a GSTIN) → state name. */
export const GST_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

export const stateOfGstin = (gstin?: string) => (gstin ? GST_STATES[gstin.slice(0, 2)] : undefined);

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ");
}

/** 12345.5 → "Rupees Twelve Thousand Three Hundred Forty Five and Fifty Paise Only" (Indian system: lakh, crore). */
export function rupeesInWords(amount: number): string {
  let n = Math.floor(amount);
  const paise = Math.round((amount - n) * 100);
  if (n === 0 && paise === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1e3);
  n %= 1e3;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  const rupees = parts.join(" ") || "Zero";
  return `Rupees ${rupees}${paise ? ` and ${twoDigits(paise)} Paise` : ""} Only`;
}
