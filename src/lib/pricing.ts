import { gstRateFor } from "./constants";

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Price a stay. Used by the server (authoritative) and by the booking form (live preview). */
export function priceStay(rates: number[], nights: number, discountPercent: number) {
  let roomCharges = 0;
  let discount = 0;
  let gstAmount = 0;
  for (const rate of rates) {
    const disc = round2((rate * discountPercent) / 100);
    const net = rate - disc;
    roomCharges += rate * nights;
    discount += disc * nights;
    // GST slab is decided per room on the (discounted) nightly rate
    gstAmount += round2((net * nights * gstRateFor(net)) / 100);
  }
  roomCharges = round2(roomCharges);
  discount = round2(discount);
  gstAmount = round2(gstAmount);
  return { roomCharges, discount, gstAmount, total: round2(roomCharges - discount + gstAmount) };
}
