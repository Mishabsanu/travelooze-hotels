import "server-only";
import type { Model } from "mongoose";
import { can, type PermissionModule } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { canAccessHotel } from "../auth/session";
import { AppError } from "../http/errors";
import { Agent } from "../models/Agent";
import { Booking } from "../models/Booking";
import { Hotel } from "../models/Hotel";
import { Role } from "../models/Role";
import { Room } from "../models/Room";
import { RoomType } from "../models/RoomType";
import { User } from "../models/User";
import { listBin, purgeBooking, restoreBooking } from "./booking/bookingActions";

export const BIN_MODULES = ["booking", "hotel", "room_type", "room", "agent", "user", "role"] as const;
export type BinModule = (typeof BIN_MODULES)[number];

export const BIN_LABELS: Record<BinModule, string> = {
  booking: "Bookings",
  hotel: "Hotels",
  room_type: "Room Types",
  room: "Rooms",
  agent: "Agents",
  user: "Users",
  role: "Roles",
};

export interface BinItem {
  _id: string;
  title: string;
  subtitle: string;
  deletedAt: string;
  deletedBy: string;
}

type Doc = Record<string, unknown> & { _id: unknown; deletedAt: Date; deletedBy?: unknown; hotel?: unknown };

const withDeleted = { withDeleted: true };
const hotelName = (d: Doc) => (d.hotel as { name?: string } | null)?.name ?? "";

/** What each module lists in the bin, and who may see it (the module's delete permission). */
const REG: Record<Exclude<BinModule, "booking">, { model: Model<never>; select: string; populate?: { path: string; select: string; options?: unknown }[]; title: (d: Doc) => string; subtitle: (d: Doc) => string; hotelOf?: (d: Doc) => unknown }> = {
  hotel: { model: Hotel as never, select: "name code category", title: (d) => String(d.name), subtitle: (d) => `${d.code} · ${d.category}`, hotelOf: (d) => d._id },
  room_type: {
    model: RoomType as never,
    select: "name hotel",
    populate: [{ path: "hotel", select: "name", options: withDeleted }],
    title: (d) => String(d.name),
    subtitle: hotelName,
    hotelOf: (d) => (d.hotel as { _id?: unknown } | null)?._id ?? d.hotel,
  },
  room: {
    model: Room as never,
    select: "number floor hotel roomType",
    populate: [
      { path: "hotel", select: "name", options: withDeleted },
      { path: "roomType", select: "name", options: withDeleted },
    ],
    title: (d) => `Room ${d.number}`,
    subtitle: (d) => [hotelName(d), (d.roomType as { name?: string } | null)?.name].filter(Boolean).join(" · "),
    hotelOf: (d) => (d.hotel as { _id?: unknown } | null)?._id ?? d.hotel,
  },
  agent: { model: Agent as never, select: "name code phone", title: (d) => String(d.name), subtitle: (d) => `${d.code ?? ""} · ${d.phone ?? ""}` },
  user: { model: User as never, select: "name email", title: (d) => String(d.name), subtitle: (d) => String(d.email ?? "") },
  role: { model: Role as never, select: "name description", title: (d) => String(d.name), subtitle: (d) => String(d.description ?? "") },
};

function allowed(user: SessionUser, module: BinModule) {
  if (module === "booking") return can(user, "booking", "delete") || can(user, "agent_booking", "delete");
  return can(user, module as PermissionModule, "delete");
}

/** Bin tabs this user may open. */
export function binModulesFor(user: SessionUser): BinModule[] {
  return BIN_MODULES.filter((m) => allowed(user, m));
}

export async function listBinItems(user: SessionUser, module: BinModule): Promise<BinItem[]> {
  if (!allowed(user, module)) throw new AppError("You do not have permission to open this recycle bin", 403);
  if (module === "booking") {
    return (await listBin(user)).map((b) => ({
      _id: b._id,
      title: `${b.bookingNo} – ${b.guest}`,
      subtitle: `${b.hotel} · Room ${b.rooms.join(", ")} · ${b.checkIn.slice(0, 10)} → ${b.checkOut.slice(0, 10)}`,
      deletedAt: b.deletedAt,
      deletedBy: b.deletedBy,
    }));
  }
  const r = REG[module];
  let q = r.model.find({ deletedAt: { $ne: null } }).setOptions(withDeleted).sort({ deletedAt: -1 }).limit(500).select(`${r.select} deletedAt deletedBy`);
  for (const p of r.populate ?? []) q = q.populate(p as never);
  const docs = (await q.populate({ path: "deletedBy", select: "name", options: withDeleted } as never).lean()) as unknown as Doc[];
  return docs
    .filter((d) => !r.hotelOf || canAccessHotel(user, r.hotelOf(d)))
    .map((d) => ({
      _id: String(d._id),
      title: r.title(d),
      subtitle: r.subtitle(d),
      deletedAt: d.deletedAt.toISOString(),
      deletedBy: (d.deletedBy as { name?: string } | null)?.name ?? "",
    }));
}

async function loadBinned(module: Exclude<BinModule, "booking">, id: string, user: SessionUser): Promise<Doc> {
  const r = REG[module];
  const d = (await r.model.findOne({ _id: id, deletedAt: { $ne: null } }).setOptions(withDeleted).lean()) as unknown as Doc | null;
  if (!d || (r.hotelOf && !canAccessHotel(user, r.hotelOf(d)))) throw new AppError("Not found in the recycle bin", 404);
  return d;
}

const unbin = { $unset: { deletedAt: 1, deletedBy: 1, deletedWith: 1 } };

/** Restore; refuses when the item would point at something that is still in the bin. */
export async function restoreItem(user: SessionUser, module: BinModule, id: string): Promise<void> {
  if (!allowed(user, module)) throw new AppError("You do not have permission to restore this", 403);
  if (module === "booking") {
    const b = await Booking.findOne({ _id: id }).setOptions(withDeleted).select("hotel agent rooms.room").lean();
    if (b && !(await Hotel.exists({ _id: String(b.hotel) }))) throw new AppError("Its hotel is in the Recycle Bin: restore the hotel first", 409);
    await restoreBooking(id, user);
    return;
  }
  const d = await loadBinned(module, id, user);
  if (module === "room_type" && !(await Hotel.exists({ _id: String(d.hotel) }))) throw new AppError("Its hotel is in the Recycle Bin: restore the hotel first", 409);
  if (module === "room") {
    if (!(await Hotel.exists({ _id: String(d.hotel) }))) throw new AppError("Its hotel is in the Recycle Bin: restore the hotel first", 409);
    if (!(await RoomType.exists({ _id: String(d.roomType) }))) throw new AppError("Its room type is in the Recycle Bin: restore the room type first", 409);
  }
  if (module === "user" && !(await Role.exists({ _id: String(d.role) }))) throw new AppError("Its role is in the Recycle Bin: restore the role first", 409);
  await REG[module].model.updateOne({ _id: id, deletedAt: { $ne: null } }, unbin as never);
  // A hotel brings back the rooms and room types that were binned with it
  if (module === "hotel") {
    await Promise.all([Room.updateMany({ deletedWith: id, deletedAt: { $ne: null } }, unbin), RoomType.updateMany({ deletedWith: id, deletedAt: { $ne: null } }, unbin)]);
  }
}

/** Delete forever (Super Admin); refuses while other records still use it. */
export async function purgeItem(user: SessionUser, module: BinModule, id: string): Promise<void> {
  if (!user.isSuperAdmin) throw new AppError("Only a Super Admin can delete for good", 403);
  if (module === "booking") return purgeBooking(id, user);
  await loadBinned(module, id, user);
  const used = async (model: Model<never>, filter: Record<string, unknown>) => Boolean(await model.exists(filter as never).setOptions(withDeleted));
  if (module === "hotel" && (await used(Booking as never, { hotel: id }))) throw new AppError("Bookings still use this hotel", 409);
  if (module === "room_type" && (await used(Room as never, { roomType: id }))) throw new AppError("Rooms still use this room type: delete them forever first", 409);
  if (module === "room" && (await used(Booking as never, { "rooms.room": id }))) throw new AppError("Bookings still use this room", 409);
  if (module === "agent" && (await used(Booking as never, { agent: id }))) throw new AppError("Bookings still use this agent", 409);
  if (module === "role" && (await used(User as never, { role: id }))) throw new AppError("Users still have this role", 409);
  if (module === "hotel") {
    await Promise.all([Room.deleteMany({ hotel: id }).setOptions(withDeleted), RoomType.deleteMany({ hotel: id }).setOptions(withDeleted)]);
  }
  await REG[module].model.deleteOne({ _id: id }).setOptions(withDeleted);
}
