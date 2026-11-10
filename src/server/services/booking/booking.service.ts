import "server-only";
import { isValidObjectId, Types } from "mongoose";
import { agentBookingsOnly, canBooking } from "@/lib/bookingAccess";
import { BOOKING_STATUS, type MealPlan, type PaymentMode } from "@/lib/constants";
import type { Booking } from "@/lib/hotelTypes";
import { can } from "@/lib/permissions";
import { perHeadRates, priceRooms, round2 } from "@/lib/pricing";
import { computeIdStatus } from "@/lib/rooming";
import type { Paginated, SessionUser } from "@/lib/types";
import type { BookingInput } from "@/lib/validation/booking.schema";
import { DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT } from "@/lib/stayTimes";
import { canAccessHotel, hotelScope } from "../../auth/session";
import { AppError, notFound } from "../../http/errors";
import { type Filter, type ListQuery, escapeRegex, listSort, paginate } from "../../http/query";
import { Agent } from "../../models/Agent";
import { Booking as BookingModel, type BookingDoc } from "../../models/Booking";
import { nextCode } from "../../models/Counter";
import { Hotel } from "../../models/Hotel";
import { Room } from "../../models/Room";
import { RoomType } from "../../models/RoomType";
import { toPlain } from "../../utils/serialize";
import { assertHotelAccess } from "../hotel.service";
import { addDays, nightsBetween, parseDay, todayIST } from "../stay";
import { holdRoomNights, releaseRoomNights } from "./availability";
import { buildLines } from "./rooming";

const POPULATE = [
  { path: "hotel", select: "name code address phone gstin checkInTime checkOutTime" },
  { path: "agent", select: "name gstin phone" },
  { path: "createdBy", select: "name -_id" },
  { path: "payments.by", select: "name -_id" },
  { path: "charges.by", select: "name -_id" },
];

type LeanBooking = Omit<BookingDoc, "hotel" | "agent"> & { hotel: unknown; agent?: unknown };

/** Adds paid / balance and serialises for the client. */
export function toBooking(doc: LeanBooking): Booking {
  const b = toPlain<Booking>(doc);
  b.idStatus = computeIdStatus(b); // before defaults: tells older bookings apart
  b.rooms = (b.rooms ?? []).map((r, i) => ({
    ...r,
    adults: r.adults ?? (i === 0 ? b.adults : 1),
    children: r.children ?? (i === 0 ? b.children : 0),
    extraBeds: r.extraBeds ?? 0,
    extraBedRate: r.extraBedRate ?? 0,
    guests: r.guests ?? [],
  }));
  b.extraBedCharges = b.extraBedCharges ?? 0;
  b.charges = b.charges ?? [];
  b.extrasTotal = round2(b.extrasTotal ?? 0);
  b.grandTotal = round2(b.total + b.extrasTotal);
  b.paid = round2((b.payments ?? []).reduce((s, p) => s + p.amount, 0));
  b.balance = round2(b.grandTotal - b.paid);
  // Agent bookings: the agent is billed the room, the guest settles the extras at the desk
  const paidByGuest = round2((b.payments ?? []).filter((p) => p.paidBy === "guest").reduce((s, p) => s + p.amount, 0));
  b.guestDue = b.billTo === "agent" ? Math.max(0, round2(b.extrasTotal - paidByGuest)) : Math.max(0, b.balance);
  b.agent = b.agent ?? null;
  return b;
}

export async function listBookings(query: ListQuery, user: SessionUser, forceSource?: "agent"): Promise<Paginated<Booking>> {
  const filter: Filter = { ...hotelScope(user) };
  const f = query.filters;
  if (f.hotel && isValidObjectId(f.hotel)) {
    assertHotelAccess(user, f.hotel);
    filter.hotel = new Types.ObjectId(f.hotel);
  }
  if (query.status in BOOKING_STATUS) filter.status = query.status;
  if (forceSource || agentBookingsOnly(user)) filter.source = "agent";
  else if (f.source === "walkin" || f.source === "agent") filter.source = f.source;
  if (f.agent && isValidObjectId(f.agent)) filter.agent = new Types.ObjectId(f.agent);
  if (f.mealPlan) filter.mealPlan = f.mealPlan;
  if (f.stay) {
    // "today": everyone in the hotel tonight; "arrivals" / "departures": today's movements
    const today = todayIST();
    if (f.stay === "arrivals") Object.assign(filter, { checkIn: today, status: "confirmed" });
    else if (f.stay === "departures") Object.assign(filter, { checkOut: { $lte: today }, status: "checked_in" });
    else if (f.stay === "inhouse") filter.status = "checked_in";
    else if (f.stay === "upcoming") Object.assign(filter, { checkIn: { $gt: today }, status: "confirmed" });
  }
  if (f.date && /^\d{4}-\d{2}-\d{2}$/.test(f.date)) {
    const d = parseDay(f.date);
    Object.assign(filter, { checkIn: { $lte: d }, checkOut: { $gt: d } });
  }
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [{ bookingNo: rx }, { "guest.name": rx }, { "guest.phone": rx }, { agentRef: rx }, { "rooms.roomNumber": rx }];
  }
  const [docs, total] = await Promise.all([
    BookingModel.find(filter)
      .sort(listSort(query, BookingModel, { checkIn: -1, createdAt: -1 }))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select("-__v")
      .populate(POPULATE)
      .lean<LeanBooking[]>(),
    BookingModel.countDocuments(filter),
  ]);
  return paginate(docs.map(toBooking), total, query);
}

export async function getBooking(id: string, user: SessionUser): Promise<Booking> {
  if (!isValidObjectId(id)) throw notFound("Booking");
  const doc = await BookingModel.findById(id).select("-__v").populate(POPULATE).lean<LeanBooking>();
  if (!doc) throw notFound("Booking");
  const hotelId = (doc.hotel as { _id: Types.ObjectId })._id;
  if (!canAccessHotel(user, hotelId) || !canBooking(user, doc.source, "view")) throw notFound("Booking");
  return toBooking(doc);
}

/** Creates a walk-in or agent booking: validates rooms, prices it, checks agent credit, then locks the room-nights. */
export async function createBooking(input: BookingInput, user: SessionUser): Promise<Booking> {
  const source = input.source as "walkin" | "agent";
  if (!canBooking(user, source, "create")) throw new AppError("You do not have permission to create this kind of booking", 403);
  assertHotelAccess(user, input.hotel);
  const hotel = await Hotel.findById(input.hotel).lean();
  if (!hotel || hotel.status !== "active") throw new AppError("Hotel not found or inactive", 422, { hotel: "Hotel is inactive" });

  const checkIn = parseDay(input.checkIn);
  const checkOut = parseDay(input.checkOut);
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1 || nights > 90) throw new AppError("Stay must be 1–90 nights", 422, { checkOut: "Stay must be 1–90 nights" });
  if (checkIn < todayIST()) throw new AppError("Check-in date is in the past", 422, { checkIn: "Date is in the past" });
  if (checkIn > addDays(todayIST(), 730)) throw new AppError("Check-in is too far ahead", 422, { checkIn: "Too far ahead" });

  const roomIds = [...new Set(input.rooms)];
  const rooms = await Room.find({ _id: { $in: roomIds }, hotel: input.hotel, status: "active" }).lean();
  if (rooms.length !== roomIds.length) throw new AppError("Some selected rooms are not valid", 422, { rooms: "Pick again" });
  const types = new Map((await RoomType.find({ _id: { $in: rooms.map((r) => r.roomType) } }).lean()).map((t) => [String(t._id), t]));
  const mealPlan = input.mealPlan as MealPlan;
  // Discount: agent contract rate, or a manual discount by someone allowed to edit rates
  let agent = null;
  let discountPercent = 0;
  if (source === "agent") {
    agent = isValidObjectId(input.agent) ? await Agent.findById(input.agent).lean() : null;
    if (!agent || agent.status !== "active") throw new AppError("Choose an active agent", 422, { agent: "Agent is inactive" });
    // Contract discount by default; the sales team may change it (or type an adjusted price) per booking
    discountPercent = input.discountPercent ?? (input.rateType === "per_head" ? 0 : agent.discountPercent);
  } else if (can(user, "room_type", "update")) {
    discountPercent = input.discountPercent ?? 0;
  }
  // Agent groups may come without a guest phone: use the agent's
  const phone = input.phone || agent?.phone || "";
  // Name can come later (needed at check-in); until then the list shows the agent / ref or "Walk-in guest"
  const guestName = input.guestName.trim();
  const displayName = guestName || (agent ? `${agent.name}${input.agentRef ? ` · ${input.agentRef}` : ""}` : "Walk-in guest");

  // Keep the order the rooms were picked in
  const ordered = roomIds.map((id) => rooms.find((r) => String(r._id) === id)!);
  const lines = buildLines(ordered, types, mealPlan, {
    lines: input.lines,
    adults: input.adults,
    children: input.children,
    guestName,
    phone,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
  });

  // Per-head (group package) rate: agreed per person per night, extra beds included, no contract discount
  const perHead = source === "agent" && input.rateType === "per_head";
  const focPax = perHead ? Math.max(0, Math.floor(input.focPax ?? 0)) : 0;
  if (perHead) {
    const pax = lines.map((l) => l.adults + l.children);
    const totalPax = pax.reduce((s, n) => s + n, 0);
    if (!(input.perHeadRate > 0)) throw new AppError("Enter the per-head rate", 422, { perHeadRate: "Enter the per-head rate" });
    if (focPax >= totalPax) throw new AppError(`Complimentary guests (${focPax}) must be fewer than the ${totalPax} guests in the rooms`, 422, { focPax: "Too many" });
    const rates = perHeadRates(pax, input.perHeadRate, focPax);
    lines.forEach((l, i) => {
      l.ratePerNight = rates[i];
      l.extraBedRate = 0;
    });
  } else if (lines.some((l) => l.ratePerNight <= 0)) {
    throw new AppError(`No ${mealPlan} rate set for one of the room types`, 422, { mealPlan: "Rate missing" });
  }
  const price = priceRooms(
    lines.map((l) => ({ rate: l.ratePerNight, extraBeds: l.extraBeds, extraBedRate: l.extraBedRate })),
    nights,
    discountPercent
  );

  const advance = round2(input.advance ?? 0);
  if (advance > price.total) throw new AppError("Advance is more than the booking total", 422, { advance: "More than total" });
  if (advance > 0 && !can(user, "payment", "create")) throw new AppError("You do not have permission to take payments", 403);
  // Agent bookings are billed to the agent (no credit limit); walk-ins to the guest
  const billTo = source === "agent" ? "agent" : "guest";

  const bookingId = new Types.ObjectId();
  await holdRoomNights(bookingId, input.hotel, roomIds, checkIn, checkOut);
  try {
    const aadhaar = (input.aadhaar || "").replace(/\D/g, "");
    await BookingModel.create({
      _id: bookingId,
      bookingNo: await nextCode(`booking-${hotel.code}`, hotel.code, 5),
      hotel: input.hotel,
      source,
      agent: agent?._id,
      agentRef: source === "agent" ? input.agentRef : "",
      billTo,
      guest: { name: displayName, phone, address: input.address, aadhaarLast4: aadhaar ? aadhaar.slice(-4) : "", idFiles: [] },
      adults: lines.reduce((n, l) => n + l.adults, 0),
      children: lines.reduce((n, l) => n + l.children, 0),
      checkIn,
      checkOut,
      // Blank = the hotel's standard times
      arrivalTime: input.arrivalTime || hotel.checkInTime || DEFAULT_CHECK_IN,
      departureTime: input.departureTime || hotel.checkOutTime || DEFAULT_CHECK_OUT,
      nights,
      mealPlan,
      rooms: lines,
      ...price,
      discountPercent,
      ...(perHead ? { perHeadRate: round2(input.perHeadRate), focPax } : {}),
      payments: advance > 0 ? [{ amount: advance, mode: input.advanceMode as PaymentMode, reference: input.advanceRef, paidBy: billTo, by: user._id }] : [],
      notes: input.notes,
      createdBy: user._id,
    });
  } catch (e) {
    await releaseRoomNights(bookingId);
    throw e;
  }
  return getBooking(String(bookingId), user);
}
