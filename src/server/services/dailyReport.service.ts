import "server-only";
import { isValidObjectId, Types } from "mongoose";
import { PAYMENT_MODES, type PaymentMode } from "@/lib/constants";
import type { SessionUser } from "@/lib/types";
import { canAccessHotel, hotelScope } from "../auth/session";
import { Booking } from "../models/Booking";
import { Room } from "../models/Room";
import { RoomNight } from "../models/RoomNight";
import { addDays, parseDay, todayIST } from "./stay";

const IST_OFFSET = 5.5 * 3600_000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface DailyPayment {
  bookingId: string;
  bookingNo: string;
  guest: string;
  rooms: string;
  at: string;
  mode: PaymentMode;
  reference: string;
  paidBy: "guest" | "agent";
  amount: number;
  by: string;
}

export interface DailyMove {
  bookingId: string;
  bookingNo: string;
  guest: string;
  phone: string;
  rooms: string;
  pax: number;
  status: string;
  source: "walkin" | "agent";
  agent: string;
  balance: number;
}

export interface DailyDue {
  bookingId: string;
  bookingNo: string;
  guest: string;
  phone: string;
  rooms: string;
  status: string;
  checkIn: string;
  checkOut: string;
  billTo: "guest" | "agent";
  agent: string;
  grandTotal: number;
  paid: number;
  balance: number;
  guestDue: number;
  agentDue: number;
}

export interface DailyReport {
  day: string;
  isToday: boolean;
  collected: { total: number; byMode: Record<PaymentMode, number>; count: number };
  /** Room revenue for this night (each stay's total ÷ its nights) + extra charges posted this day */
  earned: { rooms: number; extras: number; total: number };
  occupancy: { rooms: number; occupied: number; pct: number };
  arrivals: DailyMove[];
  departures: DailyMove[];
  payments: DailyPayment[];
  /** Open money right now: every booking not fully paid (left / staying first, then upcoming) */
  dues: DailyDue[];
  dueTotals: { guest: number; agent: number; total: number; now: number; upcoming: number };
}

type Lean = {
  _id: Types.ObjectId;
  bookingNo: string;
  source: "walkin" | "agent";
  billTo: "guest" | "agent";
  agent?: { name?: string } | null;
  guest: { name: string; phone: string };
  rooms: { roomNumber: string }[];
  adults: number;
  children: number;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  status: string;
  total: number;
  extrasTotal?: number;
  charges?: { date: Date; total: number }[];
  payments?: { amount: number; mode: PaymentMode; reference: string; paidBy: "guest" | "agent"; at: Date; by?: { name?: string } | null }[];
};

const roomsOf = (b: Lean) => b.rooms.map((r) => r.roomNumber).join(", ");

/** Same money rules as the booking page: grand total, paid, balance, and who owes it. */
function money(b: Lean) {
  const extras = b.extrasTotal ?? 0;
  const grandTotal = r2(b.total + extras);
  const paid = r2((b.payments ?? []).reduce((s, p) => s + p.amount, 0));
  const balance = r2(grandTotal - paid);
  const guestPaid = (b.payments ?? []).filter((p) => p.paidBy === "guest").reduce((s, p) => s + p.amount, 0);
  const guestDue = b.billTo === "agent" ? Math.max(0, r2(extras - guestPaid)) : Math.max(0, balance);
  const agentDue = b.billTo === "agent" ? Math.max(0, r2(balance - guestDue)) : 0;
  return { grandTotal, paid, balance, guestDue, agentDue };
}

function move(b: Lean): DailyMove {
  return {
    bookingId: String(b._id),
    bookingNo: b.bookingNo,
    guest: b.guest.name,
    phone: b.guest.phone,
    rooms: roomsOf(b),
    pax: b.adults + b.children,
    status: b.status,
    source: b.source,
    agent: b.agent?.name ?? "",
    balance: money(b).balance,
  };
}

/** One day of the front desk: money in, money earned, who came / left, and every open balance. */
export async function getDailyReport(user: SessionUser, dayStr?: string, hotelId?: string): Promise<DailyReport> {
  const today = todayIST();
  let day = today;
  try {
    if (dayStr) day = parseDay(dayStr);
  } catch {}
  const scope: Record<string, unknown> = { ...hotelScope(user) };
  if (hotelId && isValidObjectId(hotelId) && canAccessHotel(user, hotelId)) scope.hotel = new Types.ObjectId(hotelId);

  // Payments are timestamps: the IST calendar day runs 18:30 UTC (day before) → 18:30 UTC
  const start = new Date(day.getTime() - IST_OFFSET);
  const end = new Date(start.getTime() + 86_400_000);
  const next = addDays(day, 1);
  const fields = "bookingNo source billTo agent guest rooms adults children checkIn checkOut nights status total extrasTotal charges payments";

  const [paidDocs, stayDocs, arrivalDocs, departureDocs, dueDocs, roomCount, occupied] = await Promise.all([
    Booking.find({ ...scope, payments: { $elemMatch: { at: { $gte: start, $lt: end } } } })
      .select(fields)
      .populate("payments.by", "name")
      .lean<Lean[]>(),
    // Everyone sleeping here this night (for room revenue) + extras posted this day
    Booking.find({ ...scope, status: { $in: ["confirmed", "checked_in", "checked_out"] }, $or: [{ checkIn: { $lte: day }, checkOut: { $gt: day } }, { "charges.date": day }] })
      .select("checkIn checkOut nights total charges status")
      .lean<Lean[]>(),
    Booking.find({ ...scope, checkIn: day, status: { $ne: "cancelled" } }).select(fields).populate("agent", "name").sort({ status: 1, bookingNo: 1 }).lean<Lean[]>(),
    Booking.find({ ...scope, checkOut: day, status: { $in: ["confirmed", "checked_in", "checked_out"] } }).select(fields).populate("agent", "name").sort({ status: 1, bookingNo: 1 }).lean<Lean[]>(),
    Booking.find({
      ...scope,
      status: { $in: ["confirmed", "checked_in", "checked_out"] },
      $expr: { $gt: [{ $add: ["$total", { $ifNull: ["$extrasTotal", 0] }] }, { $add: [{ $sum: "$payments.amount" }, 0.009] }] },
    })
      .select(fields)
      .populate("agent", "name")
      .sort({ checkOut: 1 })
      .lean<Lean[]>(),
    Room.countDocuments({ ...scope, status: "active" }),
    RoomNight.countDocuments({ ...scope, date: day }),
  ]);

  const byMode = Object.fromEntries(Object.keys(PAYMENT_MODES).map((m) => [m, 0])) as Record<PaymentMode, number>;
  const payments: DailyPayment[] = [];
  for (const b of paidDocs) {
    for (const p of b.payments ?? []) {
      if (p.at < start || p.at >= end) continue;
      byMode[p.mode] = r2((byMode[p.mode] ?? 0) + p.amount);
      payments.push({
        bookingId: String(b._id),
        bookingNo: b.bookingNo,
        guest: b.guest.name,
        rooms: roomsOf(b),
        at: p.at.toISOString(),
        mode: p.mode,
        reference: p.reference,
        paidBy: p.paidBy,
        amount: p.amount,
        by: p.by?.name ?? "",
      });
    }
  }
  payments.sort((a, b) => a.at.localeCompare(b.at));

  let roomRevenue = 0;
  let extras = 0;
  for (const b of stayDocs) {
    if (b.checkIn <= day && b.checkOut > day && b.nights > 0) roomRevenue += b.total / b.nights;
    for (const c of b.charges ?? []) if (c.date >= day && c.date < next) extras += c.total;
  }

  // Left without paying first, then guests staying, then upcoming bookings
  const order: Record<string, number> = { checked_out: 0, checked_in: 1, confirmed: 2 };
  dueDocs.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.checkIn.getTime() - b.checkIn.getTime());
  const dues: DailyDue[] = dueDocs.map((b) => ({
    bookingId: String(b._id),
    bookingNo: b.bookingNo,
    guest: b.guest.name,
    phone: b.guest.phone,
    rooms: roomsOf(b),
    status: b.status,
    checkIn: b.checkIn.toISOString(),
    checkOut: b.checkOut.toISOString(),
    billTo: b.billTo,
    agent: b.agent?.name ?? "",
    ...money(b),
  }));
  const sum = (k: "guestDue" | "agentDue" | "balance") => r2(dues.reduce((s, d) => s + d[k], 0));

  return {
    day: day.toISOString(),
    isToday: day.getTime() === today.getTime(),
    collected: { total: r2(payments.reduce((s, p) => s + p.amount, 0)), byMode, count: payments.length },
    earned: { rooms: r2(roomRevenue), extras: r2(extras), total: r2(roomRevenue + extras) },
    occupancy: { rooms: roomCount, occupied, pct: roomCount ? Math.round((occupied / roomCount) * 100) : 0 },
    arrivals: arrivalDocs.map(move),
    departures: departureDocs.map(move),
    payments,
    dues,
    dueTotals: {
      guest: sum("guestDue"),
      agent: sum("agentDue"),
      total: sum("balance"),
      now: r2(dues.filter((d) => d.status !== "confirmed").reduce((s, d) => s + d.balance, 0)),
      upcoming: r2(dues.filter((d) => d.status === "confirmed").reduce((s, d) => s + d.balance, 0)),
    },
  };
}
