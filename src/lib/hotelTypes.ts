import type { BookingStatus, ChargeCategory, HotelCategory, MealPlan, PaymentMode, RoomStatus } from "./constants";
import type { Season } from "./seasonRates";
import type { CreatorName, RecordStatus } from "./types";

export interface Hotel {
  _id: string;
  code: string;
  name: string;
  category: HotelCategory;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  checkInTime: string;
  checkOutTime: string;
  status: RecordStatus;
  roomCount?: number;
  createdBy?: CreatorName | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoomType {
  _id: string;
  hotel: { _id: string; name: string; code: string } | null;
  name: string;
  maxAdults: number;
  maxChildren: number;
  maxExtraBeds: number;
  rates: Record<MealPlan, number>;
  extraBedRates: Record<MealPlan, number>;
  seasons?: Season[];
  status: RecordStatus;
  roomCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Room {
  _id: string;
  hotel: { _id: string; name: string; code: string } | null;
  roomType: { _id: string; name: string } | null;
  number: string;
  floor: string;
  housekeeping: RoomStatus;
  status: RecordStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Agent {
  _id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  discountPercent: number;
  creditLimit: number;
  status: RecordStatus;
  /** Billed to agent minus payments (non-cancelled bookings) */
  outstanding?: number;
  bookingCount?: number;
  createdBy?: CreatorName | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BookingGuest {
  _id: string;
  name: string;
  type: "adult" | "child";
  phone: string;
  aadhaarLast4: string;
  idFiles: string[];
}

export interface BookingRoom {
  room: string;
  roomNumber: string;
  roomType: string;
  roomTypeName: string;
  ratePerNight: number;
  adults: number;
  children: number;
  extraBeds: number;
  extraBedRate: number;
  guests: BookingGuest[];
}

export interface BookingCharge {
  _id: string;
  date: string;
  category: ChargeCategory;
  description: string;
  qty: number;
  rate: number;
  amount: number;
  gstPercent: number;
  gstAmount: number;
  total: number;
  by?: CreatorName | null;
  at: string;
}

/** Who still needs to be named / to upload an ID before check-in */
export interface IdStatus {
  adultsExpected: number;
  adultsWithId: number;
  missing: string[];
  ready: boolean;
}

export interface BookingPayment {
  _id: string;
  amount: number;
  mode: PaymentMode;
  reference: string;
  paidBy: "guest" | "agent";
  at: string;
  by?: CreatorName | null;
}

export interface Booking {
  _id: string;
  bookingNo: string;
  hotel: {
    _id: string;
    name: string;
    code: string;
    address?: string;
    phone?: string;
    gstin?: string;
    checkInTime?: string;
    checkOutTime?: string;
  } | null;
  source: "walkin" | "agent";
  agent: { _id: string; name: string; gstin?: string; phone?: string } | null;
  agentRef: string;
  billTo: "guest" | "agent";
  guest: { name: string; phone: string; address: string; aadhaarLast4: string; idFiles: string[] };
  adults: number;
  children: number;
  checkIn: string;
  checkOut: string;
  arrivalTime: string;
  departureTime: string;
  nights: number;
  mealPlan: MealPlan;
  rooms: BookingRoom[];
  roomCharges: number;
  extraBedCharges: number;
  /** Discount % applied (agent contract or edited) */
  discountPercent?: number;
  /** Set on per-head (group package) bookings: rate per person per night */
  perHeadRate?: number;
  /** Complimentary guests on a per-head booking */
  focPax?: number;
  discount: number;
  gstAmount: number;
  /** Accommodation total incl. GST */
  total: number;
  charges: BookingCharge[];
  /** Folio charges incl. their GST */
  extrasTotal: number;
  /** total + extrasTotal */
  grandTotal: number;
  paid: number;
  /** grandTotal - paid */
  balance: number;
  /** What the guest must settle at the desk (all of it, or only extras when the agent is billed) */
  guestDue: number;
  invoiceNo?: string;
  invoiceDate?: string;
  idStatus: IdStatus;
  payments: BookingPayment[];
  status: BookingStatus;
  notes: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  createdBy?: CreatorName | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Free rooms per room type for a stay, returned by /api/bookings/availability */
export interface AvailabilityType {
  _id: string;
  name: string;
  maxAdults: number;
  maxChildren: number;
  maxExtraBeds: number;
  /** Rates for this stay (season rates averaged in) */
  rates: Record<MealPlan, number>;
  extraBedRates: Record<MealPlan, number>;
  /** Normal rates, to show the season difference */
  normalRates: Record<MealPlan, number>;
  /** Seasons this stay falls in */
  seasons: string[];
  rooms: { _id: string; number: string; floor: string }[];
}
