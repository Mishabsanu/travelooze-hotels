import "server-only";
import { isValidObjectId, Types } from "mongoose";
import type { RoomStatus } from "@/lib/constants";
import type { SessionUser } from "@/lib/types";
import { canAccessHotel, hotelScope } from "../auth/session";
import { Booking } from "../models/Booking";
import { Room } from "../models/Room";
import { RoomType } from "../models/RoomType";
import { bookingMoney } from "./bookingMoney";
import { listHotelOptions } from "./hotel.service";
import { todayIST } from "./stay";

const r2 = (n: number) => Math.round(n * 100) / 100;

export type RoomToday = "occupied" | "due_out" | "arriving" | "late" | "vacant" | "maintenance";

/** Who owes the money on a booking, and how much */
export interface Collect {
  bookingId: string;
  bookingNo: string;
  status: string;
  guest: string;
  phone: string;
  agent: string;
  rooms: string;
  checkIn: string;
  checkOut: string;
  guestDue: number;
  agentDue: number;
  balance: number;
}

export interface RoomRow {
  _id: string;
  number: string;
  floor: string;
  type: string;
  housekeeping: RoomStatus;
  today: RoomToday;
  /** The booking in / arriving to this room today */
  stay: (Collect & { pax: number; roomsInBooking: number; source: "walkin" | "agent" }) | null;
  /** Next booking after today (when free now, or after the current guest) */
  next: { bookingId: string; bookingNo: string; guest: string; checkIn: string } | null;
  /** The chosen month: nights sold, room sales without GST, occupancy */
  month: { nights: number; sales: number; occupancy: number };
}

export interface RoomReport {
  hotel: string;
  hotelOptions: { value: string; label: string }[];
  month: string; // YYYY-MM
  daysInMonth: number;
  rooms: RoomRow[];
  totals: {
    rooms: number;
    occupied: number;
    vacant: number;
    maintenance: number;
    arriving: number;
    dueOut: number;
    monthNights: number;
    monthSales: number;
    occupancy: number;
    avgRate: number;
  };
  /** Every open booking with money due, split by who pays */
  fromGuests: Collect[];
  fromAgents: { agent: string; bookings: number; rooms: string; amount: number }[];
  dueTotals: { guests: number; agents: number; inHouse: number };
}

type LeanB = {
  _id: Types.ObjectId;
  bookingNo: string;
  source: "walkin" | "agent";
  billTo: "guest" | "agent";
  agent?: { name?: string } | null;
  guest: { name: string; phone: string };
  rooms: { room: Types.ObjectId; roomNumber: string }[];
  adults: number;
  children: number;
  checkIn: Date;
  checkOut: Date;
  status: string;
  total: number;
  extrasTotal?: number;
  payments?: { amount: number; paidBy: "guest" | "agent" }[];
};

function collectOf(b: LeanB): Collect {
  const m = bookingMoney(b);
  return {
    bookingId: String(b._id),
    bookingNo: b.bookingNo,
    status: b.status,
    guest: b.guest.name,
    phone: b.guest.phone,
    agent: b.agent?.name ?? "",
    rooms: b.rooms.map((r) => r.roomNumber).join(", "),
    checkIn: b.checkIn.toISOString(),
    checkOut: b.checkOut.toISOString(),
    guestDue: m.guestDue,
    agentDue: m.agentDue,
    balance: m.balance,
  };
}

/** Per-room picture of one hotel: today, money to collect, next arrival and the month's numbers. */
export async function getRoomReport(user: SessionUser, hotelId?: string, monthStr?: string): Promise<RoomReport | null> {
  const hotelOptions = await listHotelOptions(user);
  const hotel = hotelOptions.find((o) => o.value === hotelId)?.value ?? hotelOptions[0]?.value;
  if (!hotel || !isValidObjectId(hotel) || !canAccessHotel(user, hotel)) return null;
  const hotelOid = new Types.ObjectId(hotel);
  const today = todayIST();
  const month = monthStr && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthStr) ? monthStr : today.toISOString().slice(0, 7);
  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86_400_000);
  const fields = "bookingNo source billTo agent guest rooms adults children checkIn checkOut nights status total extrasTotal payments hotel";
  const scope = { ...hotelScope(user), hotel: hotelOid };

  const [rooms, types, current, upcoming, dues, perRoom] = await Promise.all([
    Room.find({ hotel: hotelOid, status: "active" }).collation({ locale: "en", numericOrdering: true }).sort({ number: 1 }).select("number floor roomType housekeeping").lean(),
    RoomType.find({ hotel: hotelOid }).select("name").lean(),
    // In the room today, arriving today, or should have arrived (late)
    Booking.find({
      ...scope,
      $or: [{ status: "checked_in" }, { status: "confirmed", checkIn: { $lte: today }, checkOut: { $gt: today } }],
    })
      .select(fields)
      .populate("agent", "name")
      .lean<LeanB[]>(),
    // Next arrivals (first one per room is kept)
    Booking.find({ ...scope, status: "confirmed", checkIn: { $gt: today } })
      .sort({ checkIn: 1 })
      .limit(1000)
      .select("bookingNo guest.name checkIn rooms.room")
      .lean<{ _id: Types.ObjectId; bookingNo: string; guest: { name: string }; checkIn: Date; rooms: { room: Types.ObjectId }[] }[]>(),
    // Every open booking with money due
    Booking.find({
      ...scope,
      status: { $in: ["confirmed", "checked_in", "checked_out"] },
      $expr: { $gt: [{ $add: ["$total", { $ifNull: ["$extrasTotal", 0] }] }, { $add: [{ $sum: "$payments.amount" }, 0.009] }] },
    })
      .select(fields)
      .populate("agent", "name")
      .sort({ checkIn: 1 })
      .lean<LeanB[]>(),
    // Month: nights and room sales (without GST) per room, from the bookings' stay nights
    Booking.aggregate<{ _id: Types.ObjectId; nights: number; sales: number }>([
      { $match: { ...scope, status: { $nin: ["cancelled", "no_show"] }, checkIn: { $lt: monthEnd }, checkOut: { $gt: monthStart } } },
      { $project: { checkIn: 1, nights: 1, total: 1, gstAmount: 1, n: { $size: "$rooms" }, line: "$rooms" } },
      { $unwind: "$line" },
      { $set: { date: { $map: { input: { $range: [0, { $max: [1, "$nights"] }] }, as: "i", in: { $dateAdd: { startDate: "$checkIn", unit: "day", amount: "$$i" } } } } } },
      { $unwind: "$date" },
      { $match: { date: { $gte: monthStart, $lt: monthEnd } } },
      {
        $group: {
          _id: "$line.room",
          nights: { $sum: 1 },
          sales: { $sum: { $divide: [{ $subtract: ["$total", { $ifNull: ["$gstAmount", 0] }] }, { $max: [1, { $multiply: ["$nights", "$n"] }] }] } },
        },
      },
    ]),
  ]);

  const typeName = new Map(types.map((t) => [String(t._id), t.name]));
  const byRoom = new Map<string, LeanB>();
  // Checked-in guests win over a (late) confirmed booking on the same room
  for (const b of current) if (b.status !== "checked_in") for (const r of b.rooms) byRoom.set(String(r.room), b);
  for (const b of current) if (b.status === "checked_in") for (const r of b.rooms) byRoom.set(String(r.room), b);
  const nextOf = new Map<string, (typeof upcoming)[number]>();
  for (const b of upcoming) for (const r of b.rooms) if (!nextOf.has(String(r.room))) nextOf.set(String(r.room), b);
  const monthOf = new Map(perRoom.map((x) => [String(x._id), x]));

  const rows: RoomRow[] = rooms.map((r) => {
    const id = String(r._id);
    const b = byRoom.get(id);
    let state: RoomToday = r.housekeeping === "maintenance" ? "maintenance" : "vacant";
    if (b) {
      if (b.status === "checked_in") state = b.checkOut <= today ? "due_out" : "occupied";
      else state = b.checkIn.getTime() === today.getTime() ? "arriving" : "late";
    }
    const n = nextOf.get(id);
    const m = monthOf.get(id);
    return {
      _id: id,
      number: r.number,
      floor: r.floor,
      type: typeName.get(String(r.roomType)) ?? "",
      housekeeping: r.housekeeping,
      today: state,
      stay: b ? { ...collectOf(b), pax: b.adults + b.children, roomsInBooking: b.rooms.length, source: b.source } : null,
      next: n ? { bookingId: String(n._id), bookingNo: n.bookingNo, guest: n.guest.name, checkIn: n.checkIn.toISOString() } : null,
      month: { nights: m?.nights ?? 0, sales: r2(m?.sales ?? 0), occupancy: Math.round(((m?.nights ?? 0) / daysInMonth) * 100) },
    };
  });

  const count = (s: RoomToday) => rows.filter((x) => x.today === s).length;
  const monthNights = rows.reduce((s, x) => s + x.month.nights, 0);
  const monthSales = r2(rows.reduce((s, x) => s + x.month.sales, 0));
  const sellable = rows.length * daysInMonth;

  const collects = dues.map(collectOf);
  const fromGuests = collects.filter((c) => c.guestDue > 0);
  const agents = new Map<string, { agent: string; bookings: number; rooms: string[]; amount: number }>();
  for (const c of collects.filter((x) => x.agentDue > 0)) {
    const a = agents.get(c.agent) ?? { agent: c.agent || "—", bookings: 0, rooms: [], amount: 0 };
    a.bookings += 1;
    a.rooms.push(c.rooms);
    a.amount = r2(a.amount + c.agentDue);
    agents.set(c.agent, a);
  }
  // Due from guests in the house right now (booking counted once even with several rooms)
  const inHouseIds = new Set(rows.filter((x) => x.stay && (x.today === "occupied" || x.today === "due_out")).map((x) => x.stay!.bookingId));

  return {
    hotel,
    hotelOptions,
    month,
    daysInMonth,
    rooms: rows,
    totals: {
      rooms: rows.length,
      occupied: count("occupied") + count("due_out"),
      vacant: count("vacant"),
      maintenance: count("maintenance"),
      arriving: count("arriving") + count("late"),
      dueOut: count("due_out"),
      monthNights,
      monthSales,
      occupancy: sellable ? Math.round((monthNights / sellable) * 100) : 0,
      avgRate: monthNights ? Math.round(monthSales / monthNights) : 0,
    },
    fromGuests,
    fromAgents: [...agents.values()].map((a) => ({ ...a, rooms: a.rooms.join(", ") })).sort((a, b) => b.amount - a.amount),
    dueTotals: {
      guests: r2(fromGuests.reduce((s, c) => s + c.guestDue, 0)),
      agents: r2([...agents.values()].reduce((s, a) => s + a.amount, 0)),
      inHouse: r2(collects.filter((c) => inHouseIds.has(c.bookingId)).reduce((s, c) => s + c.balance, 0)),
    },
  };
}
