import "server-only";
import { isValidObjectId, Types } from "mongoose";
import type { SessionUser } from "@/lib/types";
import { hotelScope } from "../auth/session";
import { Agent } from "../models/Agent";
import { Booking } from "../models/Booking";
import { addDays, parseDay, todayIST } from "./stay";

export type GroupBy = "day" | "week" | "month" | "year";
export type Preset = "today" | "week" | "month" | "year" | "custom";

export interface AgentSummary {
  _id: string;
  code: string;
  name: string;
  bookings: number;
  cancelled: number;
  roomNights: number;
  pax: number;
  total: number;
  paid: number;
  due: number;
}

export interface PeriodRow {
  period: string;
  bookings: number;
  roomNights: number;
  pax: number;
  total: number;
  paid: number;
}

export interface AgentBookingRow {
  _id: string;
  bookingNo: string;
  agent: string;
  agentRef: string;
  hotel: string;
  guest: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  pax: number;
  mealPlan: string;
  status: string;
  total: number;
  paid: number;
  balance: number;
}

export interface AgentReport {
  from: string;
  to: string;
  preset: Preset;
  groupBy: GroupBy;
  agent: string;
  agentOptions: { value: string; label: string }[];
  summary: AgentSummary[];
  periods: PeriodRow[];
  bookings: AgentBookingRow[];
  totals: Omit<AgentSummary, "_id" | "code" | "name">;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Date range of a preset, in IST calendar days (inclusive). Week = Monday to Sunday. */
function presetRange(preset: Preset, today: Date): [Date, Date] {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  if (preset === "today") return [today, today];
  if (preset === "week") {
    const monday = addDays(today, -((today.getUTCDay() + 6) % 7));
    return [monday, addDays(monday, 6)];
  }
  if (preset === "year") return [new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y, 11, 31))];
  return [new Date(Date.UTC(y, m, 1)), new Date(Date.UTC(y, m + 1, 0))];
}

const FORMAT: Record<GroupBy, string> = { day: "%Y-%m-%d", week: "%G-W%V", month: "%Y-%m", year: "%Y" };

/**
 * Agent bookings by arrival (check-in) date: totals per agent, a day / week / month / year trend and
 * the booking list. Amounts are accommodation totals incl. GST; cancelled bookings are counted apart.
 */
export async function getAgentReport(
  user: SessionUser,
  q: { preset?: string; from?: string; to?: string; agent?: string; groupBy?: string }
): Promise<AgentReport> {
  const today = todayIST();
  const preset: Preset = (["today", "week", "month", "year", "custom"] as const).find((p) => p === q.preset) ?? "month";
  let [from, to] = presetRange(preset === "custom" ? "month" : preset, today);
  if (preset === "custom") {
    try {
      if (q.from) from = parseDay(q.from);
      if (q.to) to = parseDay(q.to);
    } catch {}
    if (to < from) [from, to] = [to, from];
  }
  const groupBy: GroupBy = (["day", "week", "month", "year"] as const).find((g) => g === q.groupBy) ?? (preset === "year" ? "month" : "day");
  const agentId = q.agent && isValidObjectId(q.agent) ? q.agent : "";

  const match: Record<string, unknown> = {
    ...hotelScope(user),
    source: "agent",
    checkIn: { $gte: from, $lt: addDays(to, 1) },
    ...(agentId ? { agent: new Types.ObjectId(agentId) } : {}),
  };
  const live = { status: { $ne: "cancelled" } };
  const paidExpr = { $sum: "$payments.amount" };
  const grand = { $add: ["$total", { $ifNull: ["$extrasTotal", 0] }] };

  const [byAgent, byPeriod, list, agentDocs] = await Promise.all([
    Booking.aggregate<{ _id: Types.ObjectId; bookings: number; cancelled: number; roomNights: number; pax: number; total: number; paid: number }>([
      { $match: match },
      {
        $group: {
          _id: "$agent",
          bookings: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          roomNights: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, { $multiply: ["$nights", { $size: "$rooms" }] }, 0] } },
          pax: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, { $add: ["$adults", "$children"] }, 0] } },
          total: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, grand, 0] } },
          paid: { $sum: paidExpr },
        },
      },
    ]),
    Booking.aggregate<{ _id: string; bookings: number; roomNights: number; pax: number; total: number; paid: number }>([
      { $match: { ...match, ...live } },
      {
        $group: {
          _id: { $dateToString: { format: FORMAT[groupBy], date: "$checkIn" } },
          bookings: { $sum: 1 },
          roomNights: { $sum: { $multiply: ["$nights", { $size: "$rooms" }] } },
          pax: { $sum: { $add: ["$adults", "$children"] } },
          total: { $sum: grand },
          paid: { $sum: paidExpr },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.find(match)
      .sort({ checkIn: 1, createdAt: 1 })
      .limit(1000)
      .select("bookingNo agent agentRef hotel guest.name checkIn checkOut nights rooms.room adults children mealPlan status total extrasTotal payments.amount")
      .populate([
        { path: "agent", select: "name" },
        { path: "hotel", select: "name" },
      ])
      .lean(),
    Agent.find({}).sort({ name: 1 }).select("code name").lean(),
  ]);

  const agentName = new Map(agentDocs.map((a) => [String(a._id), a]));
  const summary: AgentSummary[] = byAgent
    .map((r) => {
      const a = agentName.get(String(r._id));
      return {
        _id: String(r._id),
        code: a?.code ?? "",
        name: a?.name ?? "—",
        bookings: r.bookings,
        cancelled: r.cancelled,
        roomNights: r.roomNights,
        pax: r.pax,
        total: r.total,
        paid: r.paid,
        due: Math.max(0, r.total - r.paid),
      };
    })
    .sort((a, b) => b.total - a.total);

  const totals = summary.reduce(
    (t, r) => ({
      bookings: t.bookings + r.bookings,
      cancelled: t.cancelled + r.cancelled,
      roomNights: t.roomNights + r.roomNights,
      pax: t.pax + r.pax,
      total: t.total + r.total,
      paid: t.paid + r.paid,
      due: t.due + r.due,
    }),
    { bookings: 0, cancelled: 0, roomNights: 0, pax: 0, total: 0, paid: 0, due: 0 }
  );

  type ListDoc = {
    _id: Types.ObjectId;
    bookingNo: string;
    agent?: { name: string } | null;
    agentRef?: string;
    hotel?: { name: string } | null;
    guest?: { name: string };
    checkIn: Date;
    checkOut: Date;
    nights: number;
    rooms: unknown[];
    adults: number;
    children: number;
    mealPlan: string;
    status: string;
    total: number;
    extrasTotal?: number;
    payments?: { amount: number }[];
  };
  const bookings: AgentBookingRow[] = (list as unknown as ListDoc[]).map((b) => {
    const total = b.status === "cancelled" ? 0 : b.total + (b.extrasTotal ?? 0);
    const paid = (b.payments ?? []).reduce((s, p) => s + p.amount, 0);
    return {
      _id: String(b._id),
      bookingNo: b.bookingNo,
      agent: b.agent?.name ?? "—",
      agentRef: b.agentRef ?? "",
      hotel: b.hotel?.name ?? "",
      guest: b.guest?.name ?? "",
      checkIn: day(b.checkIn),
      checkOut: day(b.checkOut),
      nights: b.nights,
      rooms: b.rooms.length,
      pax: b.adults + b.children,
      mealPlan: b.mealPlan,
      status: b.status,
      total,
      paid,
      balance: Math.max(0, total - paid),
    };
  });

  return {
    from: day(from),
    to: day(to),
    preset,
    groupBy,
    agent: agentId,
    agentOptions: agentDocs.map((a) => ({ value: String(a._id), label: a.name })),
    summary,
    periods: byPeriod.map((p) => ({ period: p._id, bookings: p.bookings, roomNights: p.roomNights, pax: p.pax, total: p.total, paid: p.paid })),
    bookings,
    totals,
  };
}
