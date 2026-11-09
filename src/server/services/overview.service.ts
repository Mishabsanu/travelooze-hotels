import "server-only";
import type { Types } from "mongoose";
import { MEAL_PLANS, type MealPlan } from "@/lib/constants";
import { can } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { hotelScope } from "../auth/session";
import { Agent } from "../models/Agent";
import { Booking } from "../models/Booking";
import { Hotel } from "../models/Hotel";
import { Room } from "../models/Room";
import { RoomNight } from "../models/RoomNight";
import { agentBalances } from "./agent.service";
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
  totals: { rooms: number; occupied: number; arrivals: number; departures: number; inHouse: number; overdueArrivals: number };
  month?: { revenue: number; bookings: number; collected: number };
  agentDues?: { _id: string; name: string; due: number; creditLimit: number }[];
}

const countBy = (rows: { _id: Types.ObjectId; n: number }[]) => new Map(rows.map((r) => [String(r._id), r.n]));

export async function getOverview(user: SessionUser): Promise<Overview> {
  const today = todayIST();
  const scope = hotelScope(user);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const [hotels, rooms, occupied, arrivals, departures, inHouse, overdueArrivals] = await Promise.all([
    Hotel.find({ ...hotelIdFilter(user), status: "active" }).sort({ name: 1 }).select("name").lean(),
    Room.aggregate([{ $match: { ...scope, status: "active" } }, { $group: { _id: "$hotel", n: { $sum: 1 } } }]),
    RoomNight.aggregate([{ $match: { ...scope, date: today } }, { $group: { _id: "$hotel", n: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: { ...scope, status: "confirmed", checkIn: today } }, { $group: { _id: "$hotel", n: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: { ...scope, status: "checked_in", checkOut: { $lte: today } } }, { $group: { _id: "$hotel", n: { $sum: 1 } } }]),
    Booking.find({ ...scope, status: "checked_in" }).select("hotel adults children mealPlan").lean(),
    Booking.countDocuments({ ...scope, status: "confirmed", checkIn: { $lt: today } }),
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
    today: today.toISOString(),
    hotels: list,
    totals: { rooms: sum("rooms"), occupied: sum("occupied"), arrivals: sum("arrivals"), departures: sum("departures"), inHouse: inHouse.length, overdueArrivals },
  };

  if (can(user, "report", "view")) {
    const [m] = await Booking.aggregate<{ revenue: number; bookings: number; collected: number }>([
      { $match: { ...scope, status: { $ne: "cancelled" }, checkIn: { $gte: monthStart } } },
      { $group: { _id: null, revenue: { $sum: "$total" }, bookings: { $sum: 1 }, collected: { $sum: { $sum: "$payments.amount" } } } },
    ]);
    overview.month = { revenue: m?.revenue ?? 0, bookings: m?.bookings ?? 0, collected: m?.collected ?? 0 };
  }

  if (can(user, "agent", "view")) {
    const balances = await agentBalances();
    const ids = [...balances.entries()].filter(([, b]) => b.due > 0).map(([id]) => id);
    const agents = await Agent.find({ _id: { $in: ids } }).select("name creditLimit").lean();
    overview.agentDues = agents
      .map((a) => ({ _id: String(a._id), name: a.name, creditLimit: a.creditLimit, due: balances.get(String(a._id))!.due }))
      .sort((a, b) => b.due - a.due)
      .slice(0, 8);
  }
  return overview;
}
