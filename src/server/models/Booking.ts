import { model, models, Schema, type Model, type Types } from "mongoose";
import { BOOKING_STATUS, MEAL_PLAN_CODES, PAYMENT_MODES, type BookingStatus, type MealPlan, type PaymentMode } from "@/lib/constants";

export interface BookingRoomDoc {
  room: Types.ObjectId;
  roomNumber: string;
  roomType: Types.ObjectId;
  roomTypeName: string;
  ratePerNight: number;
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
  discount: number;
  gstAmount: number;
  total: number;
  payments: PaymentDoc[];
  status: BookingStatus;
  notes: string;
  checkedInAt?: Date;
  checkedOutAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BookingRoomSchema = new Schema<BookingRoomDoc>(
  {
    room: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    roomNumber: { type: String, required: true },
    roomType: { type: Schema.Types.ObjectId, ref: "RoomType", required: true },
    roomTypeName: { type: String, required: true },
    ratePerNight: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

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
    discount: { type: Number, default: 0 },
    gstAmount: { type: Number, required: true },
    total: { type: Number, required: true },
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
