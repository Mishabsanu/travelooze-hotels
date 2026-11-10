import "server-only";
import { isValidObjectId, Types } from "mongoose";
import type { Room, RoomType } from "@/lib/hotelTypes";
import type { Option, Paginated, SessionUser } from "@/lib/types";
import {
  parseRoomNumbers,
  type RoomCreateInput,
  type RoomTypeInput,
  type RoomUpdateInput,
} from "@/lib/validation/hotel.schema";
import { hotelScope } from "../auth/session";
import { AppError, notFound } from "../http/errors";
import { type Filter, type ListQuery, listSort, paginate, searchFilter, statusFilter } from "../http/query";
import { Booking } from "../models/Booking";
import { Hotel } from "../models/Hotel";
import { Room as RoomModel } from "../models/Room";
import { RoomNight } from "../models/RoomNight";
import { RoomType as RoomTypeModel } from "../models/RoomType";
import { toPlain } from "../utils/serialize";
import { assertHotelAccess } from "./hotel.service";
import { todayIST } from "./stay";

const HOTEL = { path: "hotel", select: "name code" };

function hotelFilter(query: ListQuery, user: SessionUser): Filter {
  const filter: Filter = hotelScope(user);
  const hotel = query.filters.hotel;
  if (hotel && isValidObjectId(hotel)) {
    assertHotelAccess(user, hotel);
    filter.hotel = new Types.ObjectId(hotel);
  }
  return filter;
}

/* ───────────── Room types ───────────── */

export async function listRoomTypes(query: ListQuery, user: SessionUser): Promise<Paginated<RoomType>> {
  const filter: Filter = { ...hotelFilter(query, user), ...searchFilter(query.search, ["name"]), ...statusFilter(query.status) };
  const [docs, total] = await Promise.all([
    RoomTypeModel.find(filter)
      .sort(listSort(query, RoomTypeModel, { hotel: 1, name: 1 }))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select("-__v")
      .populate(HOTEL)
      .lean(),
    RoomTypeModel.countDocuments(filter),
  ]);
  const counts = new Map(
    (
      await RoomModel.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { roomType: { $in: docs.map((d) => d._id) }, status: "active" } },
        { $group: { _id: "$roomType", n: { $sum: 1 } } },
      ])
    ).map((r) => [String(r._id), r.n])
  );
  return paginate(
    toPlain<RoomType[]>(docs).map((t) => ({ ...t, roomCount: counts.get(t._id) ?? 0 })),
    total,
    query
  );
}

export async function getRoomType(id: string, user: SessionUser): Promise<RoomType> {
  if (!isValidObjectId(id)) throw notFound("Room type");
  const doc = await RoomTypeModel.findById(id).select("-__v").populate(HOTEL).lean();
  if (!doc) throw notFound("Room type");
  assertHotelAccess(user, doc.hotel._id ?? doc.hotel);
  return toPlain<RoomType>(doc);
}

/** New seasons come with an empty _id: let MongoDB assign one */
const withSeasonIds = (input: RoomTypeInput) => ({
  ...input,
  seasons: (input.seasons ?? []).map(({ _id, ...rest }) => (/^[a-f0-9]{24}$/i.test(_id) ? { _id, ...rest } : rest)),
});

export async function createRoomType(input: RoomTypeInput, user: SessionUser): Promise<RoomType> {
  assertHotelAccess(user, input.hotel);
  if (!(await Hotel.exists({ _id: input.hotel }))) throw new AppError("Hotel not found", 422, { hotel: "Hotel not found" });
  const doc = await RoomTypeModel.create({ ...withSeasonIds(input), createdBy: user._id });
  return getRoomType(String(doc._id), user);
}

export async function updateRoomType(id: string, input: RoomTypeInput, user: SessionUser): Promise<RoomType> {
  const existing = await getRoomType(id, user);
  if (existing.hotel?._id !== input.hotel) throw new AppError("A room type cannot be moved to another hotel", 409, { hotel: "Cannot change" });
  await RoomTypeModel.updateOne({ _id: id }, withSeasonIds(input), { runValidators: true });
  return getRoomType(id, user);
}

export async function deleteRoomType(id: string, user: SessionUser): Promise<void> {
  await getRoomType(id, user);
  const rooms = await RoomModel.countDocuments({ roomType: id });
  if (rooms) throw new AppError(`${rooms} room(s) use this type. Move or delete them first.`, 409);
  await RoomTypeModel.findByIdAndDelete(id);
}

export async function listRoomTypeOptions(user: SessionUser, hotelId?: string): Promise<(Option & { hotel: string })[]> {
  const filter: Filter = { ...hotelScope(user), status: "active" };
  if (hotelId && isValidObjectId(hotelId)) filter.hotel = new Types.ObjectId(hotelId);
  const docs = await RoomTypeModel.find(filter).sort({ name: 1 }).select("name hotel").populate(HOTEL).lean();
  return docs.map((d) => {
    const h = d.hotel as unknown as { _id: Types.ObjectId; code: string };
    return { value: String(d._id), label: `${d.name} (${h?.code ?? ""})`, hotel: String(h?._id ?? "") };
  });
}

/* ───────────── Rooms ───────────── */

export async function listRooms(query: ListQuery, user: SessionUser): Promise<Paginated<Room>> {
  const filter: Filter = { ...hotelFilter(query, user), ...searchFilter(query.search, ["number", "floor"]), ...statusFilter(query.status) };
  if (query.filters.roomType && isValidObjectId(query.filters.roomType)) filter.roomType = new Types.ObjectId(query.filters.roomType);
  if (query.filters.housekeeping) filter.housekeeping = query.filters.housekeeping;
  const [docs, total] = await Promise.all([
    RoomModel.find(filter)
      .collation({ locale: "en", numericOrdering: true })
      .sort(listSort(query, RoomModel, { hotel: 1, number: 1 }))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select("-__v")
      .populate(HOTEL)
      .populate("roomType", "name")
      .lean(),
    RoomModel.countDocuments(filter),
  ]);
  return paginate(toPlain<Room[]>(docs), total, query);
}

export async function getRoom(id: string, user: SessionUser): Promise<Room> {
  if (!isValidObjectId(id)) throw notFound("Room");
  const doc = await RoomModel.findById(id).select("-__v").populate(HOTEL).populate("roomType", "name").lean();
  if (!doc) throw notFound("Room");
  assertHotelAccess(user, (doc.hotel as unknown as { _id: Types.ObjectId })._id);
  return toPlain<Room>(doc);
}

/** Adds many rooms at once ("101-110, 115"); numbers that already exist are skipped. */
export async function createRooms(input: RoomCreateInput, user: SessionUser): Promise<{ created: number; skipped: string[] }> {
  assertHotelAccess(user, input.hotel);
  const type = await RoomTypeModel.findOne({ _id: input.roomType, hotel: input.hotel }).lean();
  if (!type) throw new AppError("This room type does not belong to the hotel", 422, { roomType: "Pick a room type of this hotel" });
  const numbers = parseRoomNumbers(input.numbers);
  const existing = new Set(
    (await RoomModel.find({ hotel: input.hotel, number: { $in: numbers } }).select("number").lean()).map((r) => r.number)
  );
  const toAdd = numbers.filter((n) => !existing.has(n));
  if (toAdd.length) {
    await RoomModel.insertMany(toAdd.map((number) => ({ hotel: input.hotel, roomType: input.roomType, number, floor: input.floor })));
  }
  return { created: toAdd.length, skipped: [...existing] };
}

async function hasUpcomingNights(roomId: string) {
  return RoomNight.exists({ room: roomId, date: { $gte: todayIST() } });
}

export async function updateRoom(id: string, input: RoomUpdateInput, user: SessionUser): Promise<Room> {
  const existing = await getRoom(id, user);
  const hotelId = existing.hotel!._id;
  const type = await RoomTypeModel.findOne({ _id: input.roomType, hotel: hotelId }).lean();
  if (!type) throw new AppError("Pick a room type of this hotel", 422, { roomType: "Pick a room type of this hotel" });
  if (input.status === "inactive" && existing.status === "active" && (await hasUpcomingNights(id))) {
    throw new AppError("This room has current or future bookings. Move them before deactivating.", 409);
  }
  await RoomModel.updateOne({ _id: id }, input, { runValidators: true });
  return getRoom(id, user);
}

/** Housekeeping-only change (clean / cleaning / maintenance) from the room list. */
export async function setHousekeeping(id: string, housekeeping: string, user: SessionUser): Promise<Room> {
  await getRoom(id, user);
  await RoomModel.updateOne({ _id: id }, { housekeeping }, { runValidators: true });
  return getRoom(id, user);
}

export async function deleteRoom(id: string, user: SessionUser): Promise<void> {
  await getRoom(id, user);
  if (await Booking.exists({ "rooms.room": id })) {
    throw new AppError("This room appears in bookings. Mark it inactive instead.", 409);
  }
  await RoomModel.findByIdAndDelete(id);
}
