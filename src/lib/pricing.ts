import { gstRateFor } from "./constants";

export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PriceLine {
  /** Room rate per night for the chosen meal plan */
  rate: number;
  extraBeds?: number;
  /** Extra bed rate per bed per night for the chosen meal plan */
  extraBedRate?: number;
}

export interface StayPrice {
  /** Room tariff only (rate × nights for every room) */
  roomCharges: number;
  /** Extra beds (beds × bed rate × nights) */
  extraBedCharges: number;
  discount: number;
  gstAmount: number;
  /** Accommodation total incl. GST (extras / folio charges are added separately) */
  total: number;
}

/**
 * Prices the accommodation. Used by the server (authoritative) and the booking form (live preview).
 * The GST slab is decided per room on its discounted nightly tariff INCLUDING extra beds.
 */
export function priceRooms(lines: PriceLine[], nights: number, discountPercent: number): StayPrice {
  let roomCharges = 0;
  let extraBedCharges = 0;
  let discount = 0;
  let gstAmount = 0;
  for (const l of lines) {
    const beds = (l.extraBeds ?? 0) * (l.extraBedRate ?? 0);
    const perNight = l.rate + beds;
    const disc = round2((perNight * discountPercent) / 100);
    const net = perNight - disc;
    roomCharges += l.rate * nights;
    extraBedCharges += beds * nights;
    discount += disc * nights;
    gstAmount += round2((net * nights * gstRateFor(net)) / 100);
  }
  roomCharges = round2(roomCharges);
  extraBedCharges = round2(extraBedCharges);
  discount = round2(discount);
  gstAmount = round2(gstAmount);
  return { roomCharges, extraBedCharges, discount, gstAmount, total: round2(roomCharges + extraBedCharges - discount + gstAmount) };
}

/** Old signature (room rates only), kept for callers that have no extra beds. */
export function priceStay(rates: number[], nights: number, discountPercent: number) {
  return priceRooms(rates.map((rate) => ({ rate })), nights, discountPercent);
}

/** One extra charge (folio line): amount + its own GST. */
export function priceCharge(qty: number, rate: number, gstPercent: number) {
  const amount = round2(qty * rate);
  const gstAmount = round2((amount * gstPercent) / 100);
  return { amount, gstAmount, total: round2(amount + gstAmount) };
}

/**
 * Group / package bookings priced per person: (all guests − complimentary) × per-head rate per night.
 * The nightly amount is spread over the rooms by how many people sleep in each, so invoices,
 * GST slabs, reports, date changes and room moves keep working on room rates.
 * Extra beds are included in the per-head rate (no separate charge).
 */
export function perHeadRates(paxPerRoom: number[], perHead: number, focPax: number): number[] {
  const total = paxPerRoom.reduce((s, n) => s + n, 0);
  if (!total || perHead <= 0) return paxPerRoom.map(() => 0);
  const charged = Math.max(0, total - focPax);
  const nightly = round2(perHead * charged);
  const rates = paxPerRoom.map((n) => round2((nightly * n) / total));
  rates[0] = round2(rates[0] + nightly - rates.reduce((s, r) => s + r, 0));
  return rates;
}

/**
 * Package price: one agreed amount for the whole stay (before GST, extra beds included).
 * Spread over the nights and over the rooms by how many people sleep in each.
 */
export function packageRates(paxPerRoom: number[], packageTotal: number, nights: number): number[] {
  if (!paxPerRoom.length || packageTotal <= 0) return paxPerRoom.map(() => 0);
  const nightly = round2(packageTotal / Math.max(1, nights));
  const weights = paxPerRoom.some((n) => n > 0) ? paxPerRoom : paxPerRoom.map(() => 1);
  const wsum = weights.reduce((s, n) => s + n, 0);
  const rates = weights.map((w) => round2((nightly * w) / wsum));
  rates[0] = round2(rates[0] + nightly - rates.reduce((s, r) => s + r, 0));
  return rates;
}

/** "Room tariff", "₹450 per head", "Package ₹50,000" — for notes / labels */
export function rateBasisLabel(b: { perHeadRate?: number | null; packageAmount?: number | null }): string {
  if (b.packageAmount) return `package ₹${b.packageAmount}`;
  if (b.perHeadRate) return `₹${b.perHeadRate}/head`;
  return "room tariff";
}
