/**
 * Rooming-list rules shared by the server (authoritative) and the screens (live hints):
 * room capacity, and "every adult has a name + ID before check-in".
 */
import type { IdStatus } from "./hotelTypes";

export interface Capacity {
  name: string;
  maxAdults: number;
  maxChildren?: number;
  maxExtraBeds?: number;
}

export interface Occupancy {
  adults: number;
  children: number;
  extraBeds: number;
}

/** Why this occupancy does not fit the room type, or null when it fits. */
export function capacityProblem(t: Capacity, o: Occupancy, roomNumber = ""): string | null {
  const maxBeds = t.maxExtraBeds ?? 1;
  const maxChildren = t.maxChildren ?? 2;
  const label = roomNumber ? `Room ${roomNumber} (${t.name})` : t.name;
  if (o.adults < 1) return `${label}: at least 1 adult`;
  if (o.extraBeds > maxBeds) return `${label}: at most ${maxBeds} extra bed(s)`;
  if (o.adults > t.maxAdults + o.extraBeds) {
    const more = o.adults - t.maxAdults - o.extraBeds;
    return `${label}: ${t.maxAdults} adult(s) + ${o.extraBeds} extra bed(s) allowed. Add ${more} extra bed(s) or another room.`;
  }
  if (o.children > maxChildren) return `${label}: at most ${maxChildren} child(ren)`;
  return null;
}

type RoomLike = {
  roomNumber: string;
  adults?: number;
  guests?: { name?: string; type?: string; idFiles?: string[] }[];
};

/**
 * ID rule: every ADULT in every room needs a name and at least one ID file before check-in.
 * Bookings made before the rooming list existed keep the old rule (one ID on the booking).
 */
export function computeIdStatus(b: { rooms: RoomLike[]; guest?: { idFiles?: string[] } }): IdStatus {
  const legacy = b.rooms.every((r) => r.guests === undefined);
  if (legacy) {
    const ok = (b.guest?.idFiles?.length ?? 0) > 0;
    return { adultsExpected: 1, adultsWithId: ok ? 1 : 0, missing: ok ? [] : ["Lead guest: ID not uploaded"], ready: ok };
  }
  let expected = 0;
  let withId = 0;
  const missing: string[] = [];
  for (const r of b.rooms) {
    const adults = r.adults ?? 1;
    expected += adults;
    const named = (r.guests ?? []).filter((g) => (g.type ?? "adult") === "adult" && g.name?.trim());
    const ok = named.filter((g) => (g.idFiles?.length ?? 0) > 0).length;
    withId += Math.min(ok, adults);
    if (named.length < adults) missing.push(`Room ${r.roomNumber}: ${adults - named.length} adult name(s) missing`);
    const noId = named.filter((g) => !(g.idFiles?.length ?? 0)).map((g) => g.name!.trim());
    if (noId.length) missing.push(`Room ${r.roomNumber}: ID missing for ${noId.join(", ")}`);
  }
  return { adultsExpected: expected, adultsWithId: withId, missing, ready: missing.length === 0 && withId >= expected };
}
