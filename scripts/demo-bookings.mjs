// Demo bookings for the last 3 weeks and the next 3 weeks, so every screen has data:
// checked-out stays, guests in-house now, today's arrivals / departures, upcoming walk-in and agent
// bookings, payments, agent outstanding, cancellations and no-shows.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

const { ObjectId } = mongoose.Types;

const DAY = 86_400_000;
// Repeatable random numbers (same demo every time)
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261109);
const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pickOne = (list) => list[Math.floor(rand() * list.length)];
const weighted = (pairs) => {
  let r = rand() * pairs.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of pairs) if ((r -= w) < 0) return v;
  return pairs[0][0];
};
const round2 = (n) => Math.round(n * 100) / 100;
// Same as src/lib/constants.ts gstRateFor
const gstRate = (rate) => (rate <= 1000 ? 0 : rate <= 7500 ? 5 : 18);

const FIRST = ["Rahul", "Priya", "Arjun", "Anjali", "Vikram", "Sneha", "Mohammed", "Fathima", "Joseph", "Meera", "Suresh", "Divya", "Aditya", "Neha", "Karthik", "Lakshmi", "Faisal", "Ritu", "Sanjay", "Kavya", "Thomas", "Aisha", "Rohan", "Pooja", "Nikhil", "Swathi"];
const LAST = ["Sharma", "Nair", "Menon", "Pillai", "Reddy", "Iyer", "Khan", "Varghese", "Gupta", "Kurian", "Das", "Patel", "Joseph", "Rao", "Thomas", "Singh"];
const CITIES = ["Kochi", "Bengaluru", "Chennai", "Mumbai", "Thrissur", "Kozhikode", "Hyderabad", "Delhi", "Pune", "Coimbatore"];
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

export async function seedDemoBookings(db, { today, hotels, agents, users, uploadDir }) {
  const bookings = [];
  const nights = [];
  const cleaning = new Set();
  // Running balance billed to each agent, kept under their credit limit (same rule as the app)
  const owed = new Map(agents.map((ag) => [String(ag._id), 0]));
  const idDir = path.resolve(uploadDir, "id-proofs");
  mkdirSync(idDir, { recursive: true });

  for (const hotel of hotels) {
    const rooms = await db.collection("rooms").find({ hotel: hotel._id }).toArray();
    const types = new Map((await db.collection("roomtypes").find({ hotel: hotel._id }).toArray()).map((t) => [String(t._id), t]));
    // One room is under maintenance from today: no stays from today on
    const maintenanceRoom = rooms[rooms.length - 1];
    await db.collection("rooms").updateOne({ _id: maintenanceRoom._id }, { $set: { housekeeping: "maintenance" } });

    for (const room of rooms) {
      const type = types.get(String(room.roomType));
      let t = today.getTime() - int(18, 22) * DAY;
      const end = today.getTime() + 24 * DAY;
      while (t < end) {
        t += weighted([[0, 3], [1, 3], [2, 2], [3, 1]]) * DAY; // empty nights between stays
        const len = weighted([[1, 3], [2, 4], [3, 3], [4, 1], [6, 1]]);
        const checkIn = new Date(t);
        const checkOut = new Date(t + len * DAY);
        t = checkOut.getTime();
        if (checkOut.getTime() > end) break;
        if (room._id.equals(maintenanceRoom._id) && checkOut > today) break;
        if (rand() < 0.22) continue; // leave the room empty for a while

        const past = checkOut <= today;
        const inHouse = checkIn <= today && checkOut > today;
        const leavesToday = checkOut.getTime() === today.getTime();
        const source = rand() < 0.4 ? "agent" : "walkin";
        const agent = source === "agent" ? pickOne(agents) : null;
        const billTo = agent && rand() < 0.8 ? "agent" : "guest";
        const mealPlan = weighted([["EP", 25], ["CP", 40], ["MAP", 20], ["AP", 15]]);

        let status;
        if (leavesToday) status = "checked_in"; // due out today
        else if (past) status = weighted([["checked_out", 90], ["cancelled", 6], ["no_show", 4]]);
        else if (inHouse) status = checkIn.getTime() === today.getTime() && rand() < 0.6 ? "confirmed" : "checked_in";
        else status = rand() < 0.06 ? "cancelled" : "confirmed";

        const rate = type.rates[mealPlan];
        const discountPct = agent ? agent.discountPercent : 0;
        const disc = round2((rate * discountPct) / 100);
        const net = rate - disc;
        const roomCharges = rate * len;
        const discount = round2(disc * len);
        const gstAmount = round2((net * len * gstRate(net)) / 100);
        const total = round2(roomCharges - discount + gstAmount);

        const bookedBy = agent ? users.sales : hotel.code === "GRD" ? users.reception : users.manager;
        const createdAt = new Date(checkIn.getTime() - int(0, 12) * DAY + int(9, 20) * 3600_000);
        const at = (base, h) => new Date(base.getTime() + h * 3600_000);

        // Payments
        const payments = [];
        const pay = (amount, when, paidBy, by) =>
          amount > 0 && payments.push({ _id: new ObjectId(), amount: round2(amount), mode: pickOne(["upi", "upi", "cash", "card", "bank"]), reference: rand() < 0.6 ? `TXN${int(100000, 999999)}` : "", paidBy, at: when, by });
        if (billTo === "agent" && status !== "cancelled") {
          const key = String(agent._id);
          const settled = status === "checked_out" && rand() < 0.85; // most past stays already paid by the agent
          const room = agent.creditLimit * 0.7 - owed.get(key); // leave headroom for new bookings
          if (agent.creditLimit === 0 || (!settled && total > room)) {
            pay(total, at(createdAt, 1), "agent", users.sales); // prepaid agent / no credit left: pays upfront
          } else if (settled) {
            pay(total, at(checkOut, 24 * int(1, 6)), "agent", users.sales);
          } else {
            owed.set(key, owed.get(key) + total);
          }
        } else if (status === "checked_out") {
          if (billTo === "agent") {
            // cancelled / no-show never reach here
          } else {
            pay(Math.min(total, round2(total * 0.3)), at(createdAt, 1), "guest", bookedBy);
            pay(total - Math.min(total, round2(total * 0.3)), at(checkOut, 10), "guest", users.reception);
          }
        } else if (status === "checked_in") {
          if (billTo === "guest") pay(round2(total * pickOne([0.3, 0.5, 1])), at(checkIn, 13), "guest", users.reception);
        } else if (status === "confirmed" && billTo === "guest" && rand() < 0.5) {
          pay(round2(total * 0.25), at(createdAt, 1), "guest", bookedBy);
        }

        const _id = new ObjectId();
        const hasId = status === "checked_in" || status === "checked_out" || (status === "confirmed" && rand() < 0.3);
        const idFiles = [];
        if (hasId) {
          const name = `${_id}-${randomUUID()}.png`;
          writeFileSync(path.join(idDir, name), PNG);
          idFiles.push(name);
        }
        const guestName = `${pickOne(FIRST)} ${pickOne(LAST)}`;
        bookings.push({
          _id,
          hotel: hotel._id,
          hotelCode: hotel.code,
          source,
          agent: agent?._id,
          agentRef: agent ? `${agent.code.replace("AGT-", "V")}/${int(1000, 9999)}` : "",
          billTo,
          guest: { name: guestName, phone: `9${int(100000000, 999999999)}`, address: pickOne(CITIES), aadhaarLast4: String(int(1000, 9999)), idFiles },
          adults: int(1, 2),
          children: rand() < 0.25 ? 1 : 0,
          checkIn,
          checkOut,
          nights: len,
          mealPlan,
          rooms: [{ room: room._id, roomNumber: room.number, roomType: type._id, roomTypeName: type.name, ratePerNight: rate }],
          roomCharges,
          discount,
          gstAmount,
          total,
          payments,
          status,
          notes:
            status === "cancelled"
              ? `Cancelled by ${agent ? "Sam Sales" : "Riya Reception"}: ${pickOne(["Guest changed plans", "Flight cancelled", "Booked elsewhere"])}`
              : status === "no_show"
                ? "No-show by Riya Reception: Guest did not arrive"
                : "",
          checkedInAt: status === "checked_in" || status === "checked_out" ? at(checkIn, 13 + int(0, 5)) : undefined,
          checkedOutAt: status === "checked_out" ? at(checkOut, 10 + int(0, 2)) : undefined,
          createdBy: bookedBy,
          createdAt,
          updatedAt: createdAt,
        });

        if (status !== "cancelled" && status !== "no_show") {
          for (let d = checkIn.getTime(); d < checkOut.getTime(); d += DAY) {
            nights.push({ room: room._id, date: new Date(d), hotel: hotel._id, booking: _id });
          }
        }
        // Rooms that guests left yesterday are still being cleaned
        if (status === "checked_out" && checkOut.getTime() === today.getTime() - DAY && !room._id.equals(maintenanceRoom._id)) cleaning.add(String(room._id));
      }
    }
  }

  // Booking numbers in the order the bookings were made, per hotel
  bookings.sort((a, b) => a.createdAt - b.createdAt);
  const seq = {};
  for (const b of bookings) {
    seq[b.hotelCode] = (seq[b.hotelCode] ?? 0) + 1;
    b.bookingNo = `${b.hotelCode}-${String(seq[b.hotelCode]).padStart(5, "0")}`;
    delete b.hotelCode;
    for (const k of ["checkedInAt", "checkedOutAt"]) if (!b[k]) delete b[k];
  }
  await db.collection("bookings").insertMany(bookings);
  await db.collection("roomnights").insertMany(nights);
  for (const [code, n] of Object.entries(seq)) {
    await db.collection("counters").updateOne({ _id: `booking-${code}` }, { $set: { seq: n, model: `hotel:booking-${code}` } }, { upsert: true });
  }
  if (cleaning.size) {
    await db.collection("rooms").updateMany({ _id: { $in: [...cleaning].map((id) => new ObjectId(id)) } }, { $set: { housekeeping: "cleaning" } });
  }
  const count = (s) => bookings.filter((b) => b.status === s).length;
  return { total: bookings.length, checkedOut: count("checked_out"), inHouse: count("checked_in"), upcoming: count("confirmed"), cancelled: count("cancelled") + count("no_show") };
}
