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
