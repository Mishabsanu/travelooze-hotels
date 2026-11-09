import "server-only";
import type { PipelineStage, Types } from "mongoose";
import type { SessionUser } from "@/lib/types";
import { hotelScope } from "../auth/session";
import { Agent } from "../models/Agent";
import { Booking } from "../models/Booking";
import { Hotel } from "../models/Hotel";
import { Room } from "../models/Room";
import { RoomNight } from "../models/RoomNight";
import { addDays, nightsBetween } from "./stay";

export type GroupBy = "day" | "week" | "month" | "year";

export interface Bucket {
  key: string; // YYYY-MM-DD of the bucket start
  walkin: number; // accommodation revenue excl. GST, recognised per stay night
  agent: number;
  extras: number; // folio excl. GST, by charge date
  nights: number; // room nights sold
  available: number; // sellable room nights
  bookings: number; // bookings made (created) in the bucket
  collected: number; // payments received in the bucket
}

export interface Breakdown {
  key: string;
  name: string;
  revenue: number;
  nights: number;
}

export interface Totals {
  revenue: number;
  roomRevenue: number;
  extras: number;
  nights: number;
  available: number;
  bookings: number;
  cancelled: number;
  collected: number;
}

export interface Analytics {
  from: string;
  to: string; // inclusive last day
  groupBy: GroupBy;
  buckets: Bucket[];
  totals: Totals;
  previous: Totals;
  byHotel: Breakdown[];
  byRoomType: Breakdown[];
  byAgent: Breakdown[];
  byMealPlan: Breakdown[];
  bySource: Breakdown[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Start of the bucket a day falls in (weeks start on Monday). Stay days are UTC midnight = IST calendar day. */
export function bucketStart(d: Date, g: GroupBy): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (g === "week") x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  if (g === "month") x.setUTCDate(1);
  if (g === "year") x.setUTCMonth(0, 1);
  return x;
}

function nextBucket(d: Date, g: GroupBy): Date {
  const x = new Date(d);
  if (g === "day") x.setUTCDate(x.getUTCDate() + 1);
  if (g === "week") x.setUTCDate(x.getUTCDate() + 7);
  if (g === "month") x.setUTCMonth(x.getUTCMonth() + 1);
  if (g === "year") x.setUTCFullYear(x.getUTCFullYear() + 1);
  return x;
}

const unitExpr = (g: GroupBy, field: string, tz: string) => ({
  $dateTrunc: { date: field, unit: g, timezone: tz, ...(g === "week" ? { startOfWeek: "monday" } : {}) },
});

/** Room-night revenue: each night carries (booking total − GST) ÷ (nights × rooms). */
function nightPipeline(scope: Record<string, unknown>, from: Date, toExcl: Date): PipelineStage[] {
  return [
    { $match: { ...scope, date: { $gte: from, $lt: toExcl } } },
    {
      $lookup: {
        from: Booking.collection.name,
        localField: "booking",
        foreignField: "_id",
        as: "b",
        pipeline: [{ $project: { total: 1, gstAmount: 1, nights: 1, source: 1, agent: 1, mealPlan: 1, status: 1, rooms: 1 } }],
      },
    },
    { $unwind: "$b" },
    { $match: { "b.status": { $ne: "cancelled" } } },
    {
      $set: {
        net: {
          $divide: [
            { $subtract: ["$b.total", { $ifNull: ["$b.gstAmount", 0] }] },
            { $max: [1, { $multiply: ["$b.nights", { $size: "$b.rooms" }] }] },
          ],
        },
        line: { $first: { $filter: { input: "$b.rooms", cond: { $eq: ["$$this.room", "$room"] } } } },
      },
    },
  ];
}

async function sellableRooms(scope: Record<string, unknown>) {
  const rows = await Room.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { ...scope, status: "active", housekeeping: { $ne: "maintenance" } } },
    { $group: { _id: "$hotel", n: { $sum: 1 } } },
  ]);
  return { total: rows.reduce((s, r) => s + r.n, 0), byHotel: new Map(rows.map((r) => [String(r._id), r.n])) };
}

async function totalsFor(scope: Record<string, unknown>, from: Date, toExcl: Date, rooms: number): Promise<Totals> {
  const [nightRow, made, paid, extras] = await Promise.all([
    RoomNight.aggregate<{ revenue: number; nights: number }>([
      ...nightPipeline(scope, from, toExcl),
      { $group: { _id: null, revenue: { $sum: "$net" }, nights: { $sum: 1 } } },
    ]),
    Booking.aggregate<{ bookings: number; cancelled: number }>([
      { $match: { ...scope, createdAt: { $gte: new Date(from.getTime() - 5.5 * 3600_000), $lt: new Date(toExcl.getTime() - 5.5 * 3600_000) } } },
      { $group: { _id: null, bookings: { $sum: 1 }, cancelled: { $sum: { $cond: [{ $in: ["$status", ["cancelled", "no_show"]] }, 1, 0] } } } },
    ]),
    Booking.aggregate<{ collected: number }>([
      { $match: { ...scope, "payments.at": { $gte: new Date(from.getTime() - 5.5 * 3600_000), $lt: new Date(toExcl.getTime() - 5.5 * 3600_000) } } },
      { $unwind: "$payments" },
      { $match: { "payments.at": { $gte: new Date(from.getTime() - 5.5 * 3600_000), $lt: new Date(toExcl.getTime() - 5.5 * 3600_000) } } },
      { $group: { _id: null, collected: { $sum: "$payments.amount" } } },
    ]),
    Booking.aggregate<{ extras: number }>([
      { $match: { ...scope, "charges.date": { $gte: from, $lt: toExcl }, status: { $ne: "cancelled" } } },
      { $unwind: "$charges" },
      { $match: { "charges.date": { $gte: from, $lt: toExcl } } },
      { $group: { _id: null, extras: { $sum: "$charges.amount" } } },
    ]),
  ]);
  const roomRevenue = r2(nightRow[0]?.revenue ?? 0);
  const ex = r2(extras[0]?.extras ?? 0);
  return {
    revenue: r2(roomRevenue + ex),
    roomRevenue,
    extras: ex,
    nights: nightRow[0]?.nights ?? 0,
    available: rooms * nightsBetween(from, toExcl),
    bookings: made[0]?.bookings ?? 0,
    cancelled: made[0]?.cancelled ?? 0,
    collected: r2(paid[0]?.collected ?? 0),
  };
}

/** Revenue, occupancy, bookings and what sells best, for [from, to] (inclusive) grouped by day / week / month / year. */
export async function getAnalytics(user: SessionUser, from: Date, to: Date, groupBy: GroupBy): Promise<Analytics> {
  const scope = hotelScope(user);
  const toExcl = addDays(to, 1);
  const len = nightsBetween(from, toExcl);
  const prevFrom = addDays(from, -len);
  const rooms = await sellableRooms(scope);

  const istShift = (field: string) => ({ $dateAdd: { startDate: field, unit: "minute", amount: 330 } });
  const [facets, made, paid, extras, totals, previous] = await Promise.all([
    RoomNight.aggregate<{
      series: { _id: { b: Date; s: string }; revenue: number; nights: number }[];
      hotel: { _id: Types.ObjectId; revenue: number; nights: number }[];
      type: { _id: string; revenue: number; nights: number }[];
      agent: { _id: Types.ObjectId; revenue: number; nights: number }[];
      plan: { _id: string; revenue: number; nights: number }[];
      source: { _id: string; revenue: number; nights: number }[];
    }>([
      ...nightPipeline(scope, from, toExcl),
      {
        $facet: {
          series: [{ $group: { _id: { b: unitExpr(groupBy, "$date", "UTC"), s: "$b.source" }, revenue: { $sum: "$net" }, nights: { $sum: 1 } } }],
          hotel: [{ $group: { _id: "$hotel", revenue: { $sum: "$net" }, nights: { $sum: 1 } } }],
          type: [{ $group: { _id: { $ifNull: ["$line.roomTypeName", "Other"] }, revenue: { $sum: "$net" }, nights: { $sum: 1 } } }],
          agent: [{ $match: { "b.source": "agent" } }, { $group: { _id: "$b.agent", revenue: { $sum: "$net" }, nights: { $sum: 1 } } }],
          plan: [{ $group: { _id: "$b.mealPlan", revenue: { $sum: "$net" }, nights: { $sum: 1 } } }],
          source: [{ $group: { _id: "$b.source", revenue: { $sum: "$net" }, nights: { $sum: 1 } } }],
        },
      },
    ]),
    Booking.aggregate<{ _id: Date; n: number }>([
      { $match: { ...scope, createdAt: { $gte: new Date(from.getTime() - 5.5 * 3600_000), $lt: new Date(toExcl.getTime() - 5.5 * 3600_000) } } },
      { $group: { _id: unitExpr(groupBy, istShift("$createdAt") as never, "UTC"), n: { $sum: 1 } } },
    ]),
    Booking.aggregate<{ _id: Date; amount: number }>([
      { $match: { ...scope, "payments.at": { $gte: new Date(from.getTime() - 5.5 * 3600_000), $lt: new Date(toExcl.getTime() - 5.5 * 3600_000) } } },
      { $unwind: "$payments" },
      { $match: { "payments.at": { $gte: new Date(from.getTime() - 5.5 * 3600_000), $lt: new Date(toExcl.getTime() - 5.5 * 3600_000) } } },
      { $group: { _id: unitExpr(groupBy, istShift("$payments.at") as never, "UTC"), amount: { $sum: "$payments.amount" } } },
    ]),
    Booking.aggregate<{ _id: Date; amount: number }>([
      { $match: { ...scope, "charges.date": { $gte: from, $lt: toExcl }, status: { $ne: "cancelled" } } },
      { $unwind: "$charges" },
      { $match: { "charges.date": { $gte: from, $lt: toExcl } } },
      { $group: { _id: unitExpr(groupBy, "$charges.date", "UTC"), amount: { $sum: "$charges.amount" } } },
    ]),
    totalsFor(scope, from, toExcl, rooms.total),
    totalsFor(scope, prevFrom, from, rooms.total),
  ]);
  const f = facets[0];

  // Zero-filled buckets across the whole range
  const buckets = new Map<string, Bucket>();
  for (let b = bucketStart(from, groupBy); b < toExcl; b = nextBucket(b, groupBy)) {
    const start = b < from ? from : b;
    const end = nextBucket(b, groupBy) > toExcl ? toExcl : nextBucket(b, groupBy);
    buckets.set(dayKey(b), { key: dayKey(b), walkin: 0, agent: 0, extras: 0, nights: 0, available: rooms.total * nightsBetween(start, end), bookings: 0, collected: 0 });
  }
  const at = (d: Date) => buckets.get(dayKey(d));
  for (const s of f.series) {
    const b = at(s._id.b);
    if (!b) continue;
    if (s._id.s === "agent") b.agent = r2(b.agent + s.revenue);
    else b.walkin = r2(b.walkin + s.revenue);
    b.nights += s.nights;
  }
  for (const m of made) if (at(m._id)) at(m._id)!.bookings = m.n;
  for (const p of paid) if (at(p._id)) at(p._id)!.collected = r2(p.amount);
  for (const e of extras) if (at(e._id)) at(e._id)!.extras = r2(e.amount);

  const [hotels, agents] = await Promise.all([
    Hotel.find({ _id: { $in: f.hotel.map((h) => h._id) } }).select("name").lean(),
    Agent.find({ _id: { $in: f.agent.map((a) => a._id) } }).select("name").lean(),
  ]);
  const hotelName = new Map(hotels.map((h) => [String(h._id), h.name]));
  const agentName = new Map(agents.map((a) => [String(a._id), a.name]));
  const rank = (rows: { _id: unknown; revenue: number; nights: number }[], name: (id: string) => string): Breakdown[] =>
    rows
      .map((r) => ({ key: String(r._id), name: name(String(r._id)), revenue: r2(r.revenue), nights: r.nights }))
      .sort((a, b) => b.revenue - a.revenue);

  return {
    from: dayKey(from),
    to: dayKey(to),
    groupBy,
    buckets: [...buckets.values()],
    totals,
    previous,
    byHotel: rank(f.hotel, (id) => hotelName.get(id) ?? "—"),
    byRoomType: rank(f.type, (id) => id),
    byAgent: rank(f.agent, (id) => agentName.get(id) ?? "—").slice(0, 10),
    byMealPlan: rank(f.plan, (id) => id),
    bySource: rank(f.source, (id) => (id === "agent" ? "B2B agents" : "Walk-in")),
  };
}
