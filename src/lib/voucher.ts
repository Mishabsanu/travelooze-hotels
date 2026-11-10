/**
 * Booking voucher text (WhatsApp / copy) and WhatsApp links. Shared by the voucher page and the lists.
 */
import { MEAL_PLANS } from "./constants";
import { formatDay, formatINR, paxLabel } from "./format";
import type { Booking } from "./hotelTypes";
import { timeLabel } from "./stayTimes";

/** Rooms grouped by type: "Standard × 10 (101, 102, …), Family × 4 (201, …)" */
export function roomSummary(b: Pick<Booking, "rooms">): { type: string; count: number; numbers: string[] }[] {
  const m = new Map<string, string[]>();
  for (const r of b.rooms) m.set(r.roomTypeName, [...(m.get(r.roomTypeName) ?? []), r.roomNumber]);
  return [...m.entries()].map(([type, numbers]) => ({ type, count: numbers.length, numbers }));
}

export function voucherText(b: Booking, showAmounts: boolean): string {
  const h = b.hotel;
  const rooms = roomSummary(b)
    .map((g) => `${g.type} × ${g.count} (${g.numbers.join(", ")})`)
    .join(", ");
  const lines = [
    `*BOOKING CONFIRMED* ✅`,
    `Voucher / Booking No: *${b.bookingNo}*`,
    b.agentRef ? `Agent Ref: ${b.agentRef}` : "",
    "",
    `Guest: *${b.guest.name}*`,
    b.agent ? `Agent: ${b.agent.name}` : "",
    `Hotel: *${h?.name ?? ""}*`,
    h?.address ? `Address: ${h.address}` : "",
    h?.phone ? `Hotel Phone: ${h.phone}` : "",
    "",
    `Check-in: *${formatDay(b.checkIn)}* (from ${timeLabel(h?.checkInTime || "12:00")})`,
    `Check-out: *${formatDay(b.checkOut)}* (by ${timeLabel(h?.checkOutTime || "11:00")})`,
    `Nights: ${b.nights}`,
    `Rooms: ${b.rooms.length} · ${rooms}`,
    `Guests: ${paxLabel(b.adults, b.children)}${b.focPax ? ` (incl. ${b.focPax} complimentary)` : ""}`,
    `Meal Plan: ${MEAL_PLANS[b.mealPlan]?.label ?? b.mealPlan}`,
    showAmounts ? "" : null,
    showAmounts ? `Total: ${formatINR(b.grandTotal)} · Paid: ${formatINR(b.paid)} · Balance: ${formatINR(b.balance)}` : null,
    "",
    "Please carry a valid photo ID for every adult at check-in.",
  ];
  return lines.filter((l) => l !== null && l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Indian mobile → 91XXXXXXXXXX for wa.me; null when it does not look like a phone number. */
export function waNumber(phone?: string | null): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

export function whatsappLink(text: string, phone?: string | null): string {
  const n = waNumber(phone);
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(text)}`;
}
