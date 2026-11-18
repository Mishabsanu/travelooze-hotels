import "server-only";
import type { Types } from "mongoose";
import { MEAL_PLANS, type MealPlan } from "@/lib/constants";
import type { SessionUser } from "@/lib/types";
import { hotelScope } from "../auth/session";
import { Booking } from "../models/Booking";
import { Hotel } from "../models/Hotel";
import { Room } from "../models/Room";
import { RoomNight } from "../models/RoomNight";
import { hotelIdFilter } from "./hotel.service";
import { todayIST } from "./stay";

export interface HotelTonight {
  _id: string;
  name: string;
  rooms: number;
  occupied: number;
  arrivals: number;
  departures: number;
  meals: { breakfast: number; lunch: number; dinner: number };
}

export interface Overview {
  today: string;
  hotels: HotelTonight[];
  /** arrivals / departures: all of today's (done + to do); *Done: already checked in / out */
  totals: { rooms: number; occupied: number; arrivals: number; arrivalsDone: number; departures: number; departuresDone: number; inHouse: number; overdueArrivals: number };
  /** Money not yet paid on every open booking (room + extras − paid): due now (staying / left) + upcoming (not arrived yet) */
  pending: { amount: number; bookings: number; now: number; upcoming: number };
}

const countBy = (rows: { _id: Types.ObjectId; n: number }[]) => new Map(rows.map((r) => [String(r._id), r.n]));

export async function getOverview(user: SessionUser): Promise<Overview> {
  const today = todayIST();
  const scope = hotelScope(user);

  // Check-out times are moments: today in India runs 18:30 UTC (yesterday) → 18:30 UTC
  const dayStart = new Date(today.getTime() - 5.5 * 3600_000);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const [hotels, rooms, occupied, arrivals, departures, inHouse, overdueArrivals, pending, arrivalsDone, departuresDone] = await Promise.all([
    Hotel.find({ ...hotelIdFilter(user), status: "active" }).sort({ name: 1 }).select("name").lean(),
    Room.aggregate([{ $match: { ...scope, status: "active" } }, { $group: { _id: "$hotel", n: { $sum: 1 } } }]),
    RoomNight.aggregate([{ $match: { ...scope, date: today } }, { $group: { _id: "$hotel", n: { $sum: 1 } } }]),
    // Arriving today: everyone booked for today (still to come + already checked in / out)
    Booking.aggregate([{ $match: { ...scope, ...arrivalsToday(today) } }, { $group: { _id: "$hotel", n: { $sum: 1 } } }]),
    // Leaving today: due out (still here) + already checked out today (also early leavers)
    Booking.aggregate([{ $match: { ...scope, ...departuresToday(today, dayStart, dayEnd) } }, { $group: { _id: "$hotel", n: { $sum: 1 } } }]),
    Booking.find({ ...scope, status: "checked_in" }).select("hotel adults children mealPlan").lean(),
    Booking.countDocuments({ ...scope, status: "confirmed", checkIn: { $lt: today } }),
    pendingDues(scope),
    Booking.countDocuments({ ...scope, checkIn: today, status: { $in: ["checked_in", "checked_out"] } }),
    Booking.countDocuments({ ...scope, status: "checked_out", checkedOutAt: { $gte: dayStart, $lt: dayEnd } }),
  ]);
  const [rc, oc, ac, dc] = [rooms, occupied, arrivals, departures].map(countBy);

  const meals = new Map<string, HotelTonight["meals"]>();
  for (const b of inHouse) {
    const key = String(b.hotel);
    const m = meals.get(key) ?? { breakfast: 0, lunch: 0, dinner: 0 };
    for (const meal of MEAL_PLANS[b.mealPlan as MealPlan].meals) m[meal as keyof typeof m] += b.adults + b.children;
    meals.set(key, m);
  }

  const list: HotelTonight[] = hotels.map((h) => {
    const id = String(h._id);
    return {
      _id: id,
      name: h.name,
      rooms: rc.get(id) ?? 0,
      occupied: oc.get(id) ?? 0,
      arrivals: ac.get(id) ?? 0,
      departures: dc.get(id) ?? 0,
      meals: meals.get(id) ?? { breakfast: 0, lunch: 0, dinner: 0 },
    };
  });
  const sum = (k: "rooms" | "occupied" | "arrivals" | "departures") => list.reduce((s, h) => s + h[k], 0);

  const overview: Overview = {
    pending,
    today: today.toISOString(),
    hotels: list,
    totals: { rooms: sum("rooms"), occupied: sum("occupied"), arrivals: sum("arrivals"), arrivalsDone, departures: sum("departures"), departuresDone, inHouse: inHouse.length, overdueArrivals },
  };

  return overview;
}

/** Bookings arriving today, whether they came already or not */
export const arrivalsToday = (today: Date) => ({ checkIn: today, status: { $in: ["confirmed", "checked_in", "checked_out"] } });

/** Bookings leaving today: still in the house and due out, or already checked out today */
export const departuresToday = (today: Date, dayStart: Date, dayEnd: Date) => ({
  $or: [
    { status: "checked_in", checkOut: { $lte: today } },
    { status: "checked_out", checkedOutAt: { $gte: dayStart, $lt: dayEnd } },
  ],
});

async function pendingDues(scope: Record<string, unknown>): Promise<Overview["pending"]> {
  const rows = await Booking.aggregate<{ _id: string; amount: number; bookings: number }>([
    { $match: { ...scope, status: { $in: ["confirmed", "checked_in", "checked_out"] } } },
    { $project: { status: 1, due: { $subtract: [{ $add: ["$total", { $ifNull: ["$extrasTotal", 0] }] }, { $sum: "$payments.amount" }] } } },
    { $match: { due: { $gt: 0.009 } } },
    { $group: { _id: { $cond: [{ $eq: ["$status", "confirmed"] }, "upcoming", "now"] }, amount: { $sum: "$due" }, bookings: { $sum: 1 } } },
  ]);
  const get = (k: string) => Math.round((rows.find((r) => r._id === k)?.amount ?? 0) * 100) / 100;
  return {
    amount: Math.round((get("now") + get("upcoming")) * 100) / 100,
    bookings: rows.reduce((s, r) => s + r.bookings, 0),
    now: get("now"),
    upcoming: get("upcoming"),
  };
}
