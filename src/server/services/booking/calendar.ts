import "server-only";
import { Types } from "mongoose";
import type { BookingStatus, RoomStatus } from "@/lib/constants";
import { Booking } from "../../models/Booking";
import { Room } from "../../models/Room";
import { RoomNight } from "../../models/RoomNight";
import { RoomType } from "../../models/RoomType";
import { addDays } from "../stay";

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  sold: number; // rooms booked for that night
  sellable: number; // active rooms not under maintenance
  arrivals: number;
  departures: number;
}

/** Per-night occupancy of one hotel for a calendar month. */
export async function getMonth(hotelId: string, year: number, month: number): Promise<CalendarDay[]> {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  const hotel = new Types.ObjectId(hotelId);
  const [sellable, nights, arrivals, departures] = await Promise.all([
    Room.countDocuments({ hotel: hotelId, status: "active", housekeeping: { $ne: "maintenance" } }),
    RoomNight.aggregate<{ _id: Date; n: number }>([
      { $match: { hotel: hotel, date: { $gte: from, $lt: to } } },
      { $group: { _id: "$date", n: { $sum: 1 } } },
    ]),
    Booking.aggregate<{ _id: Date; n: number }>([
      { $match: { hotel: hotel, status: { $in: ["confirmed", "checked_in", "checked_out"] }, checkIn: { $gte: from, $lt: to } } },
      { $group: { _id: "$checkIn", n: { $sum: { $size: "$rooms" } } } },
    ]),
    Booking.aggregate<{ _id: Date; n: number }>([
      { $match: { hotel: hotel, status: { $in: ["confirmed", "checked_in", "checked_out"] }, checkOut: { $gte: from, $lt: to } } },
      { $group: { _id: "$checkOut", n: { $sum: { $size: "$rooms" } } } },
    ]),
  ]);
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const sold = new Map(nights.map((r) => [key(r._id), r.n]));
  const arr = new Map(arrivals.map((r) => [key(r._id), r.n]));
  const dep = new Map(departures.map((r) => [key(r._id), r.n]));
  const days: CalendarDay[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) {
    const k = key(d);
    days.push({ date: k, sold: sold.get(k) ?? 0, sellable, arrivals: arr.get(k) ?? 0, departures: dep.get(k) ?? 0 });
  }
  return days;
}

export interface DayRoom {
  _id: string;
  number: string;
  floor: string;
  type: string;
  housekeeping: RoomStatus;
  /** booked = held for that night; free = nobody that night */
  state: "booked" | "free" | "maintenance";
  arriving: boolean;
  /** A guest leaves this room that morning (room may be booked again for the night) */
  departing: { _id: string; guest: string; bookingNo: string } | null;
  booking: {
    _id: string;
    bookingNo: string;
    guest: string;
    status: BookingStatus;
    source: "walkin" | "agent";
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
  } | null;
}

type NightBooking = {
  room: Types.ObjectId;
  booking: {
    _id: Types.ObjectId;
    bookingNo: string;
    status: BookingStatus;
    source: "walkin" | "agent";
    guest: { name: string };
    checkIn: Date;
    checkOut: Date;
    rooms: { room: Types.ObjectId; adults?: number; children?: number }[];
    adults: number;
    children: number;
  } | null;
};

/** Every room of the hotel for one night: booked (and by whom) or free, plus arrivals / departures. */
export async function getDayRooms(hotelId: string, date: Date): Promise<DayRoom[]> {
  const [rooms, types, nights, leaving] = await Promise.all([
    Room.find({ hotel: hotelId, status: "active" })
      .collation({ locale: "en", numericOrdering: true })
      .sort({ number: 1 })
      .select("number floor roomType housekeeping")
      .lean(),
    RoomType.find({ hotel: hotelId }).select("name").lean(),
    RoomNight.find({ hotel: hotelId, date })
      .populate({ path: "booking", select: "bookingNo status source guest.name checkIn checkOut rooms.room rooms.adults rooms.children adults children" })
      .lean<NightBooking[]>(),
    Booking.find({ hotel: hotelId, checkOut: date, status: { $in: ["confirmed", "checked_in", "checked_out"] } })
      .select("bookingNo guest.name rooms.room")
      .lean(),
  ]);
  const typeName = new Map(types.map((t) => [String(t._id), t.name]));
  const night = new Map(nights.filter((n) => n.booking).map((n) => [String(n.room), n.booking!]));
  const out = new Map<string, { _id: string; guest: string; bookingNo: string }>();
  for (const b of leaving) for (const r of b.rooms) out.set(String(r.room), { _id: String(b._id), guest: b.guest.name, bookingNo: b.bookingNo });

  return rooms.map((r) => {
    const id = String(r._id);
    const b = night.get(id);
    const line = b?.rooms.find((l) => String(l.room) === id);
    return {
      _id: id,
      number: r.number,
      floor: r.floor,
      type: typeName.get(String(r.roomType)) ?? "",
      housekeeping: r.housekeeping,
      state: b ? "booked" : r.housekeeping === "maintenance" ? "maintenance" : "free",
      arriving: Boolean(b && b.checkIn.getTime() === date.getTime()),
      departing: out.get(id) ?? null,
      booking: b
        ? {
            _id: String(b._id),
            bookingNo: b.bookingNo,
            guest: b.guest?.name ?? "",
            status: b.status,
            source: b.source,
            checkIn: b.checkIn.toISOString(),
            checkOut: b.checkOut.toISOString(),
            adults: line?.adults ?? b.adults,
            children: line?.children ?? b.children,
          }
        : null,
    };
  });
}
