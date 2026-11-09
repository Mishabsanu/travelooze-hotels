// Usage:
//   npm run seed                    -> default roles + Super Admin user (only when the database has no users)
//   npm run seed -- --demo          -> also demo hotels, rooms, agents, one user per role and ~6 weeks of bookings
//   npm run seed -- --reset --demo  -> wipes the database first (and the uploaded ID files), then the above
import { rmSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { seedDemoBookings } from "./demo-bookings.mjs";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI missing (.env.local)");
await mongoose.connect(uri);
const db = mongoose.connection.db;
const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./storage");
if (process.argv.includes("--reset")) {
  await db.dropDatabase();
  rmSync(uploadDir, { recursive: true, force: true });
  console.log("✔ Database and uploaded files cleared");
}
const now = new Date();
const stamp = { createdAt: now, updatedAt: now };
const hash = (p) => bcrypt.hash(p, 10);

// Keep in sync with src/lib/permissions.ts
const MODULES = ["user", "role", "booking", "check_in_out", "payment", "guest_id", "agent", "agent_booking", "hotel", "room_type", "room", "report"];
const grant = (spec) =>
  Object.fromEntries(
    MODULES.map((m) => {
      const a = spec[m] || "";
      return [m, { view: a.length > 0, create: a.includes("c"), update: a.includes("u"), delete: a.includes("d") }];
    })
  );
const ALL = grant(Object.fromEntries(MODULES.map((m) => [m, "vcud"])));

const ROLES = [
  { name: "Super Admin", description: "Owner / IT — full access to everything", isSuperAdmin: true, permissions: ALL },
  {
    name: "Hotel Manager",
    description: "Runs one or more hotels: front office, rooms, rates and reports",
    permissions: grant({ booking: "vcud", check_in_out: "vu", payment: "vc", guest_id: "vc", agent: "v", agent_booking: "v", hotel: "v", room_type: "vcu", room: "vcu", report: "v" }),
  },
  {
    name: "Receptionist",
    description: "Front desk: walk-in bookings, check-in / out, Aadhaar, payments, housekeeping",
    permissions: grant({ booking: "vcu", check_in_out: "vu", payment: "vc", guest_id: "vc", room: "vu" }),
  },
  {
    name: "Sales Executive",
    description: "B2B team: agents master and agent bookings, kept away from the front desk",
    permissions: grant({ agent: "vcu", agent_booking: "vcud", payment: "vc", report: "v" }),
  },
  {
    name: "Accounts",
    description: "Payments, agent outstanding and revenue reports",
    permissions: grant({ booking: "v", agent_booking: "v", payment: "vc", agent: "v", report: "v" }),
  },
];

const roles = db.collection("roles");
const roleId = {};
for (const r of ROLES) {
  const nameKey = r.name.toLowerCase();
  const existing = await roles.findOne({ nameKey });
  if (existing) roleId[r.name] = existing._id;
  else {
    const { insertedId } = await roles.insertOne({ name: r.name, nameKey, description: r.description, status: "active", isSuperAdmin: Boolean(r.isSuperAdmin), permissions: r.permissions, ...stamp });
    roleId[r.name] = insertedId;
  }
}
console.log("✔ Roles:", Object.keys(roleId).join(", "));

// Indexes the app depends on (the unique room+night index blocks double booking)
await db.collection("roomnights").createIndex({ room: 1, date: 1 }, { unique: true });
const UNIQUE = [
  ["users", { email: 1 }],
  ["roles", { nameKey: 1 }],
  ["hotels", { code: 1 }],
  ["agents", { code: 1 }],
  ["bookings", { bookingNo: 1 }],
  ["rooms", { hotel: 1, number: 1 }],
  ["roomtypes", { hotel: 1, name: 1 }],
];
for (const [name, keys] of UNIQUE) await db.collection(name).createIndex(keys, { unique: true });

const users = db.collection("users");
const user = async (name, email, password, role, extra = {}) =>
  users.insertOne({ name, email, mobile: extra.mobile || "9000000000", password: await hash(password), role: roleId[role], status: "active", allHotels: false, hotels: [], ...extra, ...stamp });

if ((await users.countDocuments()) === 0) {
  await user("Admin", "admin@hotel.local", "Admin@12345", "Super Admin", { mobile: "9000000001", allHotels: true });
  console.log("✔ Super Admin  ->  admin@hotel.local / Admin@12345   (change this password!)");
} else {
  console.log("• Users already exist, admin not created");
}

if (process.argv.includes("--demo")) {
  const hotels = db.collection("hotels");
  if (await hotels.findOne({ code: "GRD" })) {
    console.log("• Demo data already present");
  } else {
    const demo = [
      { name: "Grand Residency", code: "GRD", category: "4star", types: [["Deluxe", 3200, 3700, 4500, 5200, "101-110"], ["Suite", 6500, 7000, 8000, 9000, "201-206"], ["Executive", 8200, 8800, 9800, 10800, "301-304"]] },
      { name: "City Budget Inn", code: "CBI", category: "budget", types: [["Standard", 950, 1150, 1500, 1800, "101-112"], ["Family", 1600, 1900, 2500, 3100, "201-208"]] },
    ];
    const ids = {};
    for (const h of demo) {
      const { insertedId: hotel } = await hotels.insertOne({ name: h.name, code: h.code, category: h.category, address: "Kochi, Kerala", phone: "", email: "", gstin: "", status: "active", ...stamp });
      ids[h.code] = hotel;
      for (const [name, EP, CP, MAP, AP, range] of h.types) {
        const { insertedId: roomType } = await db.collection("roomtypes").insertOne({ hotel, name, maxAdults: 2, rates: { EP, CP, MAP, AP }, status: "active", ...stamp });
        const [a, b] = range.split("-").map(Number);
        const rooms = [];
        for (let n = a; n <= b; n++) rooms.push({ hotel, roomType, number: String(n), floor: String(Math.floor(n / 100)), housekeeping: "available", status: "active", ...stamp });
        await db.collection("rooms").insertMany(rooms);
      }
    }
    await user("Manoj Manager", "manager@hotel.local", "Manager@123", "Hotel Manager", { mobile: "9000000002", hotels: [ids.GRD, ids.CBI] });
    await user("Riya Reception", "reception@hotel.local", "Reception@123", "Receptionist", { mobile: "9000000003", hotels: [ids.GRD] });
    await user("Sam Sales", "sales@hotel.local", "Sales@12345", "Sales Executive", { mobile: "9000000004", allHotels: true });
    await user("Anu Accounts", "accounts@hotel.local", "Accounts@123", "Accounts", { mobile: "9000000005", allHotels: true });
    const AGENTS = [
      ["Sunrise Travels", "Anil Kumar", "9876543210", 15, 300000],
      ["Kerala Holidays", "Bindu Thomas", "9847012345", 12, 150000],
      ["MakeMyStay Corporate", "Rajesh Iyer", "9900112233", 10, 500000],
      ["Backpackers Hub", "Shyam", "9744556677", 8, 0],
    ];
    const agents = [];
    for (const [i, [name, contactPerson, phone, discountPercent, creditLimit]] of AGENTS.entries()) {
      const doc = { code: `AGT-${String(i + 1).padStart(4, "0")}`, name, contactPerson, phone, email: "", address: "", gstin: "", discountPercent, creditLimit, status: "active", ...stamp };
      const { insertedId } = await db.collection("agents").insertOne(doc);
      agents.push({ ...doc, _id: insertedId });
    }
    await db.collection("counters").updateOne({ _id: "agent" }, { $set: { seq: AGENTS.length, model: "hotel:agent" } }, { upsert: true });

    const userId = async (email) => (await users.findOne({ email }))._id;
    const ist = new Date(Date.now() + 5.5 * 3600_000);
    const today = new Date(`${ist.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const result = await seedDemoBookings(db, {
      today,
      hotels: await hotels.find().toArray(),
      agents,
      users: { reception: await userId("reception@hotel.local"), manager: await userId("manager@hotel.local"), sales: await userId("sales@hotel.local") },
      uploadDir,
    });
    console.log(`✔ Demo bookings: ${result.total} (${result.checkedOut} checked out, ${result.inHouse} in-house, ${result.upcoming} upcoming, ${result.cancelled} cancelled / no-show)`);
    console.log("✔ Demo: 2 hotels, 46 rooms, 4 agents and these logins:");
    console.log("  manager@hotel.local   / Manager@123    Hotel Manager (both hotels)");
    console.log("  reception@hotel.local / Reception@123  Receptionist (Grand Residency only)");
    console.log("  sales@hotel.local     / Sales@12345    Sales Executive (all hotels)");
    console.log("  accounts@hotel.local  / Accounts@123   Accounts (all hotels)");
  }
}
await mongoose.disconnect();
