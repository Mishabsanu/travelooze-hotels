import { model, models, Schema, type Model, type Types } from "mongoose";
import {
  BOOKING_STATUS,
  CHARGE_CATEGORIES,
  MEAL_PLAN_CODES,
  PAYMENT_MODES,
  type BookingStatus,
  type ChargeCategory,
  type MealPlan,
  type PaymentMode,
} from "@/lib/constants";

export interface GuestDoc {
  _id: Types.ObjectId;
  name: string;
  type: "adult" | "child";
  phone: string;
  aadhaarLast4: string;
  /** Private Cloudinary references (see server/storage.ts) */
  idFiles: string[];
}

export interface BookingRoomDoc {
  room: Types.ObjectId;
  roomNumber: string;
  roomType: Types.ObjectId;
  roomTypeName: string;
  ratePerNight: number;
  adults: number;
  children: number;
  extraBeds: number;
  extraBedRate: number;
  /** Rooming list: who stays in this room (names can be filled in up to check-in) */
  guests: GuestDoc[];
}

export interface ChargeDoc {
  _id: Types.ObjectId;
  date: Date;
  category: ChargeCategory;
  description: string;
  qty: number;
  rate: number;
  amount: number;
  gstPercent: number;
  gstAmount: number;
  total: number;
  by?: Types.ObjectId;
  at: Date;
}

export interface PaymentDoc {
  _id: Types.ObjectId;
  amount: number;
  mode: PaymentMode;
  reference: string;
  paidBy: "guest" | "agent";
  at: Date;
  by?: Types.ObjectId;
}

export interface BookingDoc {
  _id: Types.ObjectId;
  bookingNo: string;
  hotel: Types.ObjectId;
  source: "walkin" | "agent";
  agent?: Types.ObjectId;
  agentRef: string;
  billTo: "guest" | "agent";
  guest: { name: string; phone: string; address: string; aadhaarLast4: string; idFiles: string[] };
  adults: number;
  children: number;
  checkIn: Date;
  checkOut: Date;
  /** Expected arrival / departure time of the guest, "HH:mm" (IST); defaults to the hotel standard times */
  arrivalTime: string;
  departureTime: string;
  nights: number;
  mealPlan: MealPlan;
  rooms: BookingRoomDoc[];
  roomCharges: number;
  extraBedCharges: number;
  /** Discount % applied (agent contract or manual); kept so re-pricing uses the same % */
  discountPercent?: number;
  /** Group / package rate per person per night (set = per-head pricing; room rates are derived from it) */
  perHeadRate?: number;
  /** Complimentary guests, not charged */
  focPax?: number;
  discount: number;
  gstAmount: number;
  /** Accommodation total incl. GST (what an agent is billed) */
  total: number;
  /** Folio: restaurant, laundry, … (always the guest's to pay) */
  charges: ChargeDoc[];
  extrasTotal: number;
  /** GST invoice number, e.g. GRD/2026-27/0001 (given once, on first invoice) */
  invoiceNo?: string;
  invoiceDate?: Date;
  payments: PaymentDoc[];
  status: BookingStatus;
  notes: string;
  checkedInAt?: Date;
  checkedOutAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GuestEntrySchema = new Schema<GuestDoc>({
  name: { type: String, default: "", trim: true },
  type: { type: String, enum: ["adult", "child"], default: "adult" },
  phone: { type: String, default: "", trim: true },
  aadhaarLast4: { type: String, default: "" },
  idFiles: { type: [String], default: [] },
});

const BookingRoomSchema = new Schema<BookingRoomDoc>(
  {
    room: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    roomNumber: { type: String, required: true },
    roomType: { type: Schema.Types.ObjectId, ref: "RoomType", required: true },
    roomTypeName: { type: String, required: true },
    ratePerNight: { type: Number, required: true, min: 0 },
    adults: { type: Number, default: 1, min: 0 },
    children: { type: Number, default: 0, min: 0 },
    extraBeds: { type: Number, default: 0, min: 0 },
    extraBedRate: { type: Number, default: 0, min: 0 },
    guests: { type: [GuestEntrySchema], default: [] },
  },
  { _id: false }
);

const ChargeSchema = new Schema<ChargeDoc>({
  date: { type: Date, required: true },
  category: { type: String, enum: Object.keys(CHARGE_CATEGORIES), required: true },
  description: { type: String, default: "", trim: true },
  qty: { type: Number, required: true, min: 0.01 },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true },
  gstPercent: { type: Number, default: 0, min: 0, max: 28 },
  gstAmount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  by: { type: Schema.Types.ObjectId, ref: "User" },
  at: { type: Date, default: Date.now },
});

const PaymentSchema = new Schema<PaymentDoc>({
  amount: { type: Number, required: true, min: 0.01 },
  mode: { type: String, enum: Object.keys(PAYMENT_MODES), required: true },
  reference: { type: String, default: "", trim: true },
  paidBy: { type: String, enum: ["guest", "agent"], default: "guest" },
  at: { type: Date, default: Date.now },
  by: { type: Schema.Types.ObjectId, ref: "User" },
});

const GuestSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    // Only the last 4 digits of Aadhaar are kept
    aadhaarLast4: { type: String, default: "" },
    // Private Cloudinary references "<resource>|<publicId>|<ext>" (served only through the API)
    idFiles: { type: [String], default: [] },
  },
  { _id: false }
);

const BookingSchema = new Schema<BookingDoc>(
  {
    bookingNo: { type: String, required: true, unique: true },
    hotel: { type: Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },
    source: { type: String, enum: ["walkin", "agent"], required: true, index: true },
    agent: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
    agentRef: { type: String, default: "", trim: true },
    billTo: { type: String, enum: ["guest", "agent"], default: "guest" },
    guest: { type: GuestSchema, required: true },
    adults: { type: Number, default: 1, min: 1 },
    children: { type: Number, default: 0, min: 0 },
    // Stay dates at UTC midnight
    checkIn: { type: Date, required: true, index: true },
    checkOut: { type: Date, required: true, index: true },
    arrivalTime: { type: String, default: "" },
    departureTime: { type: String, default: "" },
    nights: { type: Number, required: true, min: 1 },
    mealPlan: { type: String, enum: MEAL_PLAN_CODES, required: true },
    rooms: { type: [BookingRoomSchema], validate: (v: unknown[]) => v.length > 0 },
    roomCharges: { type: Number, required: true },
    extraBedCharges: { type: Number, default: 0 },
    discountPercent: { type: Number, min: 0, max: 100 },
    perHeadRate: { type: Number, min: 0 },
    focPax: { type: Number, min: 0 },
    discount: { type: Number, default: 0 },
    gstAmount: { type: Number, required: true },
    total: { type: Number, required: true },
    charges: { type: [ChargeSchema], default: [] },
    extrasTotal: { type: Number, default: 0 },
    invoiceNo: { type: String },
    invoiceDate: { type: Date },
    payments: { type: [PaymentSchema], default: [] },
    status: { type: String, enum: Object.keys(BOOKING_STATUS), default: "confirmed", index: true },
    notes: { type: String, default: "" },
    checkedInAt: Date,
    checkedOutAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
BookingSchema.index({ createdAt: -1 });
// Indexes for the busiest screens (bookings list, arrivals / departures, agent balances)
BookingSchema.index({ hotel: 1, checkIn: -1 });
BookingSchema.index({ hotel: 1, status: 1, checkIn: 1 });
BookingSchema.index({ status: 1, checkOut: 1 });
BookingSchema.index({ agent: 1, billTo: 1, status: 1 });

export const Booking: Model<BookingDoc> = (models.Booking as Model<BookingDoc>) || model<BookingDoc>("Booking", BookingSchema);
