export const MEAL_PLANS = {
  EP: { label: "EP – Room only", meals: [] as string[] },
  CP: { label: "CP – Breakfast", meals: ["breakfast"] },
  MAP: { label: "MAP – Breakfast + Dinner", meals: ["breakfast", "dinner"] },
  AP: { label: "AP – All meals", meals: ["breakfast", "lunch", "dinner"] },
} as const;
export type MealPlan = keyof typeof MEAL_PLANS;
export const MEAL_PLAN_CODES = Object.keys(MEAL_PLANS) as MealPlan[];

export const HOTEL_CATEGORIES = {
  budget: "Budget",
  standard: "Standard",
  "2star": "2 Star",
  "3star": "3 Star",
  "4star": "4 Star",
} as const;
export type HotelCategory = keyof typeof HOTEL_CATEGORIES;

export const BOOKING_STATUS = {
  confirmed: "Confirmed",
  checked_in: "Checked in",
  checked_out: "Checked out",
  cancelled: "Cancelled",
  no_show: "No show",
} as const;
export type BookingStatus = keyof typeof BOOKING_STATUS;

export const PAYMENT_MODES = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank: "Bank transfer",
} as const;
export type PaymentMode = keyof typeof PAYMENT_MODES;

/** Housekeeping status of a room (separate from active / inactive) */
export const ROOM_STATUS = {
  available: "Clean",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
} as const;
export type RoomStatus = keyof typeof ROOM_STATUS;

/**
 * Indian GST on room tariff, by per-night room rate.
 * Slabs as of the Sept 2025 revision: ≤ ₹1,000 exempt, ≤ ₹7,500 → 5%, above → 18%.
 * Confirm with your accountant; change here if rules change.
 */
export function gstRateFor(ratePerNight: number): number {
  if (ratePerNight <= 1000) return 0;
  if (ratePerNight <= 7500) return 5;
  return 18;
}

export const toOptions = (map: Record<string, string>) => Object.entries(map).map(([value, label]) => ({ value, label }));

/** Extra charges on a booking (folio). GST % is the default and can be changed per charge. SAC = GST service code. */
export const CHARGE_CATEGORIES = {
  restaurant: { label: "Restaurant / Food", gst: 5, sac: "996331" },
  room_service: { label: "Room Service", gst: 5, sac: "996332" },
  laundry: { label: "Laundry", gst: 18, sac: "999712" },
  minibar: { label: "Minibar", gst: 18, sac: "996331" },
  transport: { label: "Transport / Cab", gst: 5, sac: "996412" },
  other: { label: "Other Service", gst: 18, sac: "999799" },
} as const;
export type ChargeCategory = keyof typeof CHARGE_CATEGORIES;

/** SAC code for hotel accommodation */
export const SAC_ACCOMMODATION = "996311";
