import "server-only";
import type { Types } from "mongoose";
import type { MealPlan } from "@/lib/constants";
import type { AvailabilityType } from "@/lib/hotelTypes";
import { AppError } from "../../http/errors";
import { Room } from "../../models/Room";
import { RoomNight } from "../../models/RoomNight";
import { RoomType } from "../../models/RoomType";
import { eachNight } from "../stay";

/** Active rooms of a hotel that are free for every night in [checkIn, checkOut), grouped by room type. */
export async function getAvailability(hotelId: string, checkIn: Date, checkOut: Date): Promise<AvailabilityType[]> {
  const [types, rooms, taken] = await Promise.all([
    RoomType.find({ hotel: hotelId, status: "active" }).sort({ name: 1 }).lean(),
    Room.find({ hotel: hotelId, status: "active", housekeeping: { $ne: "maintenance" } })
      .collation({ locale: "en", numericOrdering: true })
      .sort({ number: 1 })
      .lean(),
    RoomNight.distinct("room", { hotel: hotelId, date: { $gte: checkIn, $lt: checkOut } }),
  ]);
  const takenSet = new Set(taken.map(String));
  return types.map((t) => ({
    _id: String(t._id),
    name: t.name,
    maxAdults: t.maxAdults,
    rates: t.rates as Record<MealPlan, number>,
    rooms: rooms
      .filter((r) => String(r.roomType) === String(t._id) && !takenSet.has(String(r._id)))
      .map((r) => ({ _id: String(r._id), number: r.number, floor: r.floor })),
  }));
}

/**
 * Locks the room-nights first (unique room + date index). If any night is already held, what was
 * inserted is rolled back and the booking fails, so a room can never be sold twice.
 */
export async function holdRoomNights(bookingId: Types.ObjectId, hotelId: string, roomIds: string[], checkIn: Date, checkOut: Date) {
  const docs = roomIds.flatMap((room) => eachNight(checkIn, checkOut).map((date) => ({ room, date, hotel: hotelId, booking: bookingId })));
  try {
    await RoomNight.insertMany(docs, { ordered: true });
  } catch (e) {
    await RoomNight.deleteMany({ booking: bookingId });
    if ((e as { code?: number }).code === 11000) {
      throw new AppError("One of the selected rooms was just booked by someone else. Please pick again.", 409, {
        rooms: "Room no longer free",
      });
    }
    throw e;
  }
}

/** Frees a booking's nights (cancel), or only the nights from `fromDate` on (early check-out). */
export async function releaseRoomNights(bookingId: Types.ObjectId | string, fromDate?: Date) {
  await RoomNight.deleteMany({ booking: bookingId, ...(fromDate ? { date: { $gte: fromDate } } : {}) });
}

