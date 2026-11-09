import "server-only";
import { isValidObjectId, type Types } from "mongoose";
import type { BookingStatus, MealPlan, RoomStatus } from "@/lib/constants";
import { Booking } from "../../models/Booking";
import { Room } from "../../models/Room";
import { RoomNight } from "../../models/RoomNight";
import { RoomType } from "../../models/RoomType";
import { addDays } from "../stay";

/** One booked night in the grid (consecutive nights of the same booking are merged in the UI). */
export interface GridCell {
  _id: string;
  bookingNo: string;
  guest: string;
  status: BookingStatus;
  source: "walkin" | "agent";
  agent: string;
  mealPlan: MealPlan;
  checkIn: string;
  checkOut: string;
  balance: number;
}

export interface GridRoom {
  _id: string;
  number: string;
  floor: string;
  housekeeping: RoomStatus;
  rates: Record<MealPlan, number>;
  cells: (GridCell | null)[];
}

export interface Grid {
  days: string[];
  types: { _id: string; name: string; rooms: GridRoom[] }[];
  /** Sellable rooms still free on each day */
  freeByDay: number[];
  totalRooms: number;
}

type PopulatedNight = {
  room: Types.ObjectId;
  date: Date;
  booking: {
    _id: Types.ObjectId;
    bookingNo: string;
    status: BookingStatus;
    source: "walkin" | "agent";
    agent?: { name: string } | null;
    mealPlan: MealPlan;
    guest: { name: string };
    checkIn: Date;
    checkOut: Date;
    total: number;
    payments: { amount: number }[];
  } | null;
};

/** Room × day booking grid for one hotel (optionally one room type). */
export async function getGrid(hotelId: string, from: Date, days: number, roomTypeId?: string): Promise<Grid> {
  const to = addDays(from, days);
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const typeFilter = roomTypeId && isValidObjectId(roomTypeId) ? { _id: roomTypeId } : {};

  const [types, rooms, nights] = await Promise.all([
    RoomType.find({ hotel: hotelId, ...typeFilter }).sort({ name: 1 }).select("name rates").lean(),
    Room.find({ hotel: hotelId, status: "active", ...(roomTypeId && isValidObjectId(roomTypeId) ? { roomType: roomTypeId } : {}) })
      .collation({ locale: "en", numericOrdering: true })
      .sort({ number: 1 })
      .select("number floor roomType housekeeping")
      .lean(),
    RoomNight.find({ hotel: hotelId, date: { $gte: from, $lt: to } })
      .populate({
        path: "booking",
        select: "bookingNo status source agent mealPlan guest.name checkIn checkOut total payments.amount",
        populate: { path: "agent", select: "name" },
      })
      .lean<PopulatedNight[]>(),
  ]);

  const cell = new Map<string, GridCell>();
  for (const n of nights) {
    const b = n.booking;
    if (!b) continue;
    cell.set(`${n.room}|${n.date.getTime()}`, {
      _id: String(b._id),
      bookingNo: b.bookingNo,
      guest: b.guest?.name ?? "",
      status: b.status,
      source: b.source,
      agent: b.agent?.name ?? "",
      mealPlan: b.mealPlan,
      checkIn: b.checkIn.toISOString(),
      checkOut: b.checkOut.toISOString(),
      balance: Math.round((b.total - (b.payments ?? []).reduce((s, p) => s + p.amount, 0)) * 100) / 100,
    });
  }

  const grid = types.map((t) => ({
    _id: String(t._id),
    name: t.name,
    rooms: rooms
      .filter((r) => String(r.roomType) === String(t._id))
      .map((r) => ({
        _id: String(r._id),
        number: r.number,
        floor: r.floor,
        housekeeping: r.housekeeping,
        rates: t.rates as Record<MealPlan, number>,
        cells: dates.map((d) => cell.get(`${r._id}|${d.getTime()}`) ?? null),
      })),
  }));
  const sellable = grid.flatMap((t) => t.rooms).filter((r) => r.housekeeping !== "maintenance");
  return {
    days: dates.map((d) => d.toISOString()),
    types: grid,
    freeByDay: dates.map((_, i) => sellable.filter((r) => !r.cells[i]).length),
    totalRooms: grid.reduce((s, t) => s + t.rooms.length, 0),
  };
}

/* ───────────── Room status board (today) ───────────── */

export type RoomState = "vacant" | "occupied" | "arriving" | "due_out" | "reserved";

export interface BoardRoom {
  _id: string;
  number: string;
  floor: string;
  type: string;
  housekeeping: RoomStatus;
  state: RoomState;
  /** Booking that explains the state (guest in room, arriving, leaving) */
  booking: { _id: string; bookingNo: string; guest: string; checkOut: string; source: string; balance: number } | null;
}

/** What every room of a hotel is doing today: in-house, arriving, leaving, vacant. */
export async function getRoomBoard(hotelId: string, today: Date): Promise<BoardRoom[]> {
  const [rooms, types, tonight, leaving] = await Promise.all([
    Room.find({ hotel: hotelId, status: "active" })
      .collation({ locale: "en", numericOrdering: true })
      .sort({ number: 1 })
      .select("number floor roomType housekeeping")
      .lean(),
    RoomType.find({ hotel: hotelId }).select("name").lean(),
    RoomNight.find({ hotel: hotelId, date: today })
      .populate({ path: "booking", select: "bookingNo status source guest.name checkIn checkOut total payments.amount" })
      .lean<PopulatedNight[]>(),
    // Checked-in guests whose stay ends today (their room-night for tonight is no longer held)
    Booking.find({ hotel: hotelId, status: "checked_in", checkOut: { $lte: today } })
      .select("bookingNo source guest.name checkOut total payments.amount rooms.room")
      .lean(),
  ]);
  const typeName = new Map(types.map((t) => [String(t._id), t.name]));
  const night = new Map(tonight.map((n) => [String(n.room), n.booking]));
  const out = new Map<string, (typeof leaving)[number]>();
  for (const b of leaving) for (const r of b.rooms) out.set(String(r.room), b);
  const balanceOf = (b: { total: number; payments?: { amount: number }[] }) =>
    Math.round((b.total - (b.payments ?? []).reduce((s, p) => s + p.amount, 0)) * 100) / 100;

  return rooms.map((r) => {
    const id = String(r._id);
    const n = night.get(id);
    const o = out.get(id);
    let state: RoomState = "vacant";
    let booking: BoardRoom["booking"] = null;
    if (o) {
      state = "due_out";
      booking = { _id: String(o._id), bookingNo: o.bookingNo, guest: o.guest.name, checkOut: o.checkOut.toISOString(), source: o.source, balance: balanceOf(o) };
    } else if (n) {
      state = n.status === "checked_in" ? "occupied" : n.checkIn.getTime() === today.getTime() ? "arriving" : "reserved";
      booking = { _id: String(n._id), bookingNo: n.bookingNo, guest: n.guest.name, checkOut: n.checkOut.toISOString(), source: n.source, balance: balanceOf(n) };
    }
    return { _id: id, number: r.number, floor: r.floor, type: typeName.get(String(r.roomType)) ?? "", housekeeping: r.housekeeping, state, booking };
  });
}
