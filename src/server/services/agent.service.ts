import "server-only";
import { isValidObjectId, Types } from "mongoose";
import type { Agent } from "@/lib/hotelTypes";
import type { Option, Paginated, SessionUser } from "@/lib/types";
import type { AgentInput } from "@/lib/validation/agent.schema";
import { AppError, notFound } from "../http/errors";
import { type Filter, type ListQuery, listSort, paginate, searchFilter, statusFilter } from "../http/query";
import { Agent as AgentModel } from "../models/Agent";
import { Booking } from "../models/Booking";
import { nextCode } from "../models/Counter";
import { toPlain } from "../utils/serialize";

const SEARCH_FIELDS = ["name", "code", "contactPerson", "phone", "email"];
const CREATOR = { path: "createdBy", select: "name -_id" };
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface AgentBalance {
  billed: number;
  paid: number;
  due: number;
  count: number;
}

/** Billed-to-agent totals minus payments, per agent (cancelled bookings excluded). */
/** `scope` limits to some hotels (header switcher); leave empty for the company-wide credit check. */
export async function agentBalances(agentIds?: Types.ObjectId[], scope: Filter = {}): Promise<Map<string, AgentBalance>> {
  const match: Filter = { source: "agent", billTo: "agent", status: { $ne: "cancelled" }, ...scope };
  if (agentIds) match.agent = { $in: agentIds };
  const rows = await Booking.aggregate<{ _id: Types.ObjectId; billed: number; paid: number; count: number }>([
    { $match: match },
    { $group: { _id: "$agent", billed: { $sum: "$total" }, paid: { $sum: { $sum: "$payments.amount" } }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { billed: round2(r.billed), paid: round2(r.paid), count: r.count, due: round2(r.billed - r.paid) }]));
}

export async function listAgents(query: ListQuery, scope: Filter = {}): Promise<Paginated<Agent>> {
  const filter: Filter = { ...searchFilter(query.search, SEARCH_FIELDS), ...statusFilter(query.status) };
  const [docs, total] = await Promise.all([
    AgentModel.find(filter)
      .sort(listSort(query, AgentModel, { name: 1 }))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select("-__v")
      .populate(CREATOR)
      .lean(),
    AgentModel.countDocuments(filter),
  ]);
  const balances = await agentBalances(docs.map((d) => d._id), scope);
  const items = toPlain<Agent[]>(docs).map((a) => ({
    ...a,
    outstanding: balances.get(a._id)?.due ?? 0,
    bookingCount: balances.get(a._id)?.count ?? 0,
  }));
  return paginate(items, total, query);
}

export async function getAgent(id: string, scope: Filter = {}): Promise<Agent & { balance: AgentBalance }> {
  if (!isValidObjectId(id)) throw notFound("Agent");
  const doc = await AgentModel.findById(id).select("-__v").populate(CREATOR).lean();
  if (!doc) throw notFound("Agent");
  const balance = (await agentBalances([doc._id], scope)).get(id) ?? { billed: 0, paid: 0, due: 0, count: 0 };
  return { ...toPlain<Agent>(doc), outstanding: balance.due, bookingCount: balance.count, balance };
}

export async function createAgent(input: AgentInput, user: SessionUser): Promise<Agent> {
  const doc = await AgentModel.create({ ...input, code: await nextCode("agent", "AGT"), createdBy: user._id });
  return getAgent(String(doc._id));
}

export async function updateAgent(id: string, input: AgentInput): Promise<Agent> {
  await getAgent(id);
  await AgentModel.updateOne({ _id: id }, input, { runValidators: true });
  return getAgent(id);
}

export async function deleteAgent(id: string): Promise<void> {
  await getAgent(id);
  if (await Booking.exists({ agent: id })) throw new AppError("This agent has bookings. Mark it inactive instead.", 409);
  await AgentModel.findByIdAndDelete(id);
}

export async function listAgentOptions(): Promise<(Option & { discountPercent: number })[]> {
  const docs = await AgentModel.find({ status: "active" }).sort({ name: 1 }).select("name discountPercent").limit(1000).lean();
  return docs.map((d) => ({ value: String(d._id), label: `${d.name} (${d.discountPercent}%)`, discountPercent: d.discountPercent }));
}
