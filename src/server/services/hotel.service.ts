import "server-only";
import { isValidObjectId, Types } from "mongoose";
import type { HotelCategory } from "@/lib/constants";
import type { Hotel } from "@/lib/hotelTypes";
import type { Option, Paginated, SessionUser } from "@/lib/types";
import type { HotelInput } from "@/lib/validation/hotel.schema";
import { assignedHotelScope, canAccessHotel } from "../auth/session";
import { AppError, notFound } from "../http/errors";
import { type Filter, type ListQuery, listSort, paginate, searchFilter, statusFilter } from "../http/query";
import { Booking } from "../models/Booking";
import { Hotel as HotelModel } from "../models/Hotel";
import { Room } from "../models/Room";
import { RoomType } from "../models/RoomType";
import { toPlain } from "../utils/serialize";

const SEARCH_FIELDS = ["name", "code", "address", "phone"];
const CREATOR = { path: "createdBy", select: "name -_id" };

/** Hotels this user works at (Super Admin / "All hotels" users see every hotel). */
export function hotelIdFilter(user: SessionUser): Filter {
  return user.allHotels ? {} : { _id: { $in: user.hotelIds.map((id) => new Types.ObjectId(id)) } };
}

export function assertHotelAccess(user: SessionUser, hotelId: unknown) {
  if (!canAccessHotel(user, hotelId)) throw new AppError("You are not assigned to this hotel", 403);
}

async function roomCounts(ids: Types.ObjectId[]) {
  const rows = await Room.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { hotel: { $in: ids }, status: "active" } },
    { $group: { _id: "$hotel", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export async function listHotels(query: ListQuery, user: SessionUser): Promise<Paginated<Hotel>> {
  const filter: Filter = { ...assignedHotelScope(user), ...searchFilter(query.search, SEARCH_FIELDS), ...statusFilter(query.status) };
  if (query.filters.category) filter.category = query.filters.category;
  const [docs, total] = await Promise.all([
    HotelModel.find(filter)
      .sort(listSort(query, HotelModel, { name: 1 }))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select("-__v")
      .populate(CREATOR)
      .lean(),
    HotelModel.countDocuments(filter),
  ]);
  const counts = await roomCounts(docs.map((d) => d._id));
  const items = toPlain<Hotel[]>(docs).map((h) => ({ ...h, roomCount: counts.get(h._id) ?? 0 }));
  return paginate(items, total, query);
}

export async function getHotel(id: string, user: SessionUser): Promise<Hotel> {
  if (!isValidObjectId(id)) throw notFound("Hotel");
  if (!(user.assignedAll || user.assignedHotelIds.includes(id))) throw new AppError("You are not assigned to this hotel", 403);
  const doc = await HotelModel.findById(id).select("-__v").populate(CREATOR).lean();
  if (!doc) throw notFound("Hotel");
  const counts = await roomCounts([doc._id]);
  return { ...toPlain<Hotel>(doc), roomCount: counts.get(id) ?? 0 };
}

export async function createHotel(input: HotelInput, user: SessionUser): Promise<Hotel> {
  const doc = await HotelModel.create({ ...input, category: input.category as HotelCategory, createdBy: user._id });
  return getHotel(String(doc._id), { ...user, allHotels: true });
}

export async function updateHotel(id: string, input: HotelInput, user: SessionUser): Promise<Hotel> {
  const existing = await getHotel(id, user);
  if (existing.code !== input.code && (await Booking.exists({ hotel: id }))) {
    throw new AppError("The code is used in existing booking numbers and cannot be changed", 409, { code: "Cannot change after bookings exist" });
  }
  await HotelModel.updateOne({ _id: id }, input, { runValidators: true });
  return getHotel(id, user);
}

export async function deleteHotel(id: string, user: SessionUser): Promise<void> {
  await getHotel(id, user);
  if (await Booking.exists({ hotel: id })) {
    throw new AppError("This hotel has bookings. Mark it inactive instead of deleting it.", 409);
  }
  await Promise.all([Room.deleteMany({ hotel: id }), RoomType.deleteMany({ hotel: id })]);
  await HotelModel.findByIdAndDelete(id);
}

/** Hotels for dropdowns, limited to the user's hotels. */
export async function listHotelOptions(user: SessionUser, { includeInactive = false } = {}): Promise<Option[]> {
  const filter: Filter = { ...hotelIdFilter(user), ...(includeInactive ? {} : { status: "active" }) };
  const docs = await HotelModel.find(filter).sort({ name: 1 }).select("name code status").limit(500).lean();
  return docs.map((d) => ({ value: String(d._id), label: d.status === "active" ? d.name : `${d.name} (inactive)` }));
}

/** Every hotel (for assigning users), regardless of the admin's own assignment. */
export async function listAllHotelOptions(): Promise<Option[]> {
  const docs = await HotelModel.find().sort({ name: 1 }).select("name status").limit(500).lean();
  return docs.map((d) => ({ value: String(d._id), label: d.status === "active" ? d.name : `${d.name} (inactive)` }));
}
