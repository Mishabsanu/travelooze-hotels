import "server-only";
import type { Types } from "mongoose";
import type { SessionUser } from "@/lib/types";
import { hotelScope } from "../auth/session";
import { Agent } from "../models/Agent";
import { Booking } from "../models/Booking";
import { Hotel } from "../models/Hotel";
import { agentBalances } from "./agent.service";
import { addDays, parseDay, todayIST } from "./stay";

export interface RevenueRow {
  _id: string;
  name: string;
  bookings: number;
  roomNights: number;
  roomCharges: number;
  discount: number;
  gst: number;
  total: number;
  collected: number;
  walkin: number;
  agent: number;
}

export interface Report {
  from: string;
  to: string;
  rows: RevenueRow[];
  totals: Omit<RevenueRow, "_id" | "name">;
  agents: { _id: string; code: string; name: string; billed: number; paid: number; due: number; creditLimit: number; count: number }[];
}

/** Revenue by hotel for bookings arriving in [from, to], plus every agent's outstanding balance. */
export async function getReport(user: SessionUser, fromStr?: string, toStr?: string, withAgents = false): Promise<Report> {
  const today = todayIST();
  const safe = (s: string | undefined, fallback: Date) => {
    try {
      return s ? parseDay(s) : fallback;
    } catch {
      return fallback;
    }
  };
  const from = safe(fromStr, new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
  const to = safe(toStr, today);

  const rows = await Booking.aggregate<Omit<RevenueRow, "name"> & { _id: Types.ObjectId }>([
    { $match: { ...hotelScope(user), status: { $ne: "cancelled" }, checkIn: { $gte: from, $lt: addDays(to, 1) } } },
    {
      $group: {
        _id: "$hotel",
        bookings: { $sum: 1 },
        roomNights: { $sum: { $multiply: ["$nights", { $size: "$rooms" }] } },
        roomCharges: { $sum: "$roomCharges" },
        discount: { $sum: "$discount" },
        gst: { $sum: "$gstAmount" },
        total: { $sum: "$total" },
        collected: { $sum: { $sum: "$payments.amount" } },
        walkin: { $sum: { $cond: [{ $eq: ["$source", "walkin"] }, "$total", 0] } },
        agent: { $sum: { $cond: [{ $eq: ["$source", "agent"] }, "$total", 0] } },
      },
    },
  ]);
  const names = new Map((await Hotel.find({ _id: { $in: rows.map((r) => r._id) } }).select("name").lean()).map((h) => [String(h._id), h.name]));
  const list: RevenueRow[] = rows
    .map((r) => ({ ...r, _id: String(r._id), name: names.get(String(r._id)) ?? "—" }))
    .sort((a, b) => b.total - a.total);
  const keys = ["bookings", "roomNights", "roomCharges", "discount", "gst", "total", "collected", "walkin", "agent"] as const;
  const totals = Object.fromEntries(keys.map((k) => [k, list.reduce((s, r) => s + r[k], 0)])) as Report["totals"];

  let agents: Report["agents"] = [];
  if (withAgents) {
    const balances = await agentBalances(undefined, hotelScope(user));
    const docs = await Agent.find({ _id: { $in: [...balances.keys()] } }).select("code name creditLimit").lean();
    agents = docs
      .map((a) => ({ _id: String(a._id), code: a.code, name: a.name, creditLimit: a.creditLimit, ...balances.get(String(a._id))! }))
      .sort((a, b) => b.due - a.due);
  }
  return { from: from.toISOString(), to: to.toISOString(), rows: list, totals, agents };
}
