const r2 = (n: number) => Math.round(n * 100) / 100;

export interface MoneyInput {
  billTo: "guest" | "agent";
  total: number;
  extrasTotal?: number;
  payments?: { amount: number; paidBy: "guest" | "agent" }[];
}

/**
 * Same money rules as the booking page: grand total (room + extras), paid, balance, and who owes it.
 * Agent-billed bookings: the agent owes the room, the guest owes the extras.
 */
export function bookingMoney(b: MoneyInput) {
  const extras = b.extrasTotal ?? 0;
  const grandTotal = r2(b.total + extras);
  const paid = r2((b.payments ?? []).reduce((s, p) => s + p.amount, 0));
  const balance = r2(grandTotal - paid);
  const guestPaid = (b.payments ?? []).filter((p) => p.paidBy === "guest").reduce((s, p) => s + p.amount, 0);
  const guestDue = b.billTo === "agent" ? Math.max(0, r2(extras - guestPaid)) : Math.max(0, balance);
  const agentDue = b.billTo === "agent" ? Math.max(0, r2(balance - guestDue)) : 0;
  return { grandTotal, paid, balance, guestDue, agentDue };
}
