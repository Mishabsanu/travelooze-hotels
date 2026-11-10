import * as Yup from "yup";
import { CHARGE_CATEGORIES, MEAL_PLAN_CODES, PAYMENT_MODES } from "../constants";
import { objectId, optionalText, PHONE_PATTERN, requiredText } from "./common";

// Guest name / phone / ID are optional when booking and checked at check-in

/** "HH:mm" or empty (empty = hotel standard time) */
export const optionalTime = (label: string) =>
  Yup.string().default("").matches(/^$|^([01]\d|2[0-3]):[0-5]\d$/, `${label} must be HH:MM`);

/** Actual check-in / check-out moment from the pop-up, "YYYY-MM-DDTHH:mm" in IST (empty = now) */
export const momentField = Yup.string().default("").matches(/^$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a valid date and time");

export const guestEntrySchema = Yup.object({
  _id: Yup.string().default(""),
  name: optionalText("Guest name", 100),
  type: Yup.string().oneOf(["adult", "child"]).default("adult"),
  phone: optionalText("Phone", 20),
});

/** One booked room: who and how many stay in it */
export const roomLineSchema = Yup.object({
  room: Yup.string().required().matches(/^[a-f0-9]{24}$/i, "Invalid room"),
  adults: Yup.number().typeError("Enter a number").integer().min(1, "At least 1 adult per room").required(),
  children: Yup.number().typeError("Enter a number").integer().min(0).default(0),
  extraBeds: Yup.number().typeError("Enter a number").integer().min(0).default(0),
  guests: Yup.array().of(guestEntrySchema).default([]),
});

/** Rooming list edit on an existing booking */
export const roomingSchema = Yup.object({
  lines: Yup.array().of(roomLineSchema).min(1).required(),
});
export type RoomingInput = Yup.InferType<typeof roomingSchema>;

/** Folio: one extra charge */
export const chargeSchema = Yup.object({
  category: Yup.string().oneOf(Object.keys(CHARGE_CATEGORIES), "Choose a category").required(),
  description: optionalText("Description", 120),
  qty: Yup.number().typeError("Enter a number").moreThan(0, "Enter a quantity").required("Quantity is required"),
  rate: Yup.number().typeError("Enter a number").min(0, "Cannot be negative").required("Rate is required"),
  gstPercent: Yup.number().typeError("Enter a number").min(0).max(28).required(),
  date: Yup.string().default("").matches(/^$|^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});
export type ChargeInput = Yup.InferType<typeof chargeSchema>;

/** Change stay dates (extend / shorten / move the whole stay) */
export const datesSchema = Yup.object({
  checkIn: Yup.string().required().matches(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  checkOut: Yup.string()
    .required()
    .matches(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .test("after", "Check-out must be after check-in", function (v) {
      return !v || v > this.parent.checkIn;
    }),
});

/** Move one booked room to another room */
export const moveSchema = Yup.object({
  fromRoom: Yup.string().required().matches(/^[a-f0-9]{24}$/i),
  toRoom: Yup.string().required("Choose the new room").matches(/^[a-f0-9]{24}$/i, "Choose the new room"),
  rate: Yup.string().oneOf(["keep", "new"]).default("keep"),
});

const day = (label: string) => Yup.string().required(`${label} is required`).matches(/^\d{4}-\d{2}-\d{2}$/, `${label} is invalid`);

export const bookingSchema = Yup.object({
  source: Yup.string().oneOf(["walkin", "agent"]).required(),
  hotel: objectId("Hotel"),
  agent: Yup.string()
    .default("")
    .when("source", { is: "agent", then: (s) => s.required("Choose an agent").matches(/^[a-f0-9]{24}$/i, "Choose an agent") }),
  agentRef: optionalText("Agent reference", 60),
  billTo: Yup.string().oneOf(["guest", "agent"]).default("guest"),
  /** room = room tariff of the meal plan; per_head = group / package rate per person per night (agent bookings) */
  rateType: Yup.string().oneOf(["room", "per_head"]).default("room"),
  perHeadRate: Yup.number()
    .typeError("Enter a number")
    .min(0, "Cannot be negative")
    .default(0)
    .when("rateType", { is: "per_head", then: (s) => s.moreThan(0, "Enter the per-head rate") }),
  /** Complimentary guests (tour leader, driver: the "+2" in "49 + 2") who stay but are not charged */
  focPax: Yup.number().typeError("Enter a number").integer().min(0, "Cannot be negative").default(0),
  checkIn: day("Check-in"),
  checkOut: day("Check-out").test("after", "Check-out must be after check-in", function (v) {
    return !v || !this.parent.checkIn || v > this.parent.checkIn;
  }),
  arrivalTime: optionalTime("Arrival time"),
  departureTime: optionalTime("Departure time"),
  mealPlan: Yup.string().oneOf(MEAL_PLAN_CODES, "Choose a meal plan").required(),
  rooms: Yup.array().of(Yup.string().required()).min(1, "Select at least one room").required(),
  /** Occupancy per selected room (optional: without it the old adults/children fields are spread over the rooms) */
  lines: Yup.array().of(roomLineSchema).default([]),
  adults: Yup.number().typeError("Enter a number").integer().min(1, "At least 1 adult").default(1),
  children: Yup.number().typeError("Enter a number").integer().min(0).default(0),
  guestName: optionalText("Guest name", 100),
  // Agent groups often come without a guest phone: the agent's phone is used then
  phone: Yup.string()
    .trim()
    .default("")
    .test("phone", "Phone must be a valid phone number", (v) => !v || PHONE_PATTERN.test(v)),
  address: optionalText("Address", 300),
  aadhaar: Yup.string()
    .default("")
    .test("aadhaar", "Aadhaar must be 12 digits", (v) => !v || v.replace(/\D/g, "").length === 12),
  /** Blank (null) = the default: agent contract % (room tariff), 0 otherwise. Editable, also via "adjusted price". */
  discountPercent: Yup.number().typeError("Enter a number").min(0, "Cannot be negative").max(100, "At most 100%").nullable().default(null),
  advance: Yup.number().typeError("Enter a number").min(0, "Cannot be negative").default(0),
  advanceMode: Yup.string().oneOf(Object.keys(PAYMENT_MODES)).default("upi"),
  advanceRef: optionalText("Payment reference", 60),
  overrideCredit: Yup.boolean().default(false),
  notes: optionalText("Notes", 500),
});
export type BookingInput = Yup.InferType<typeof bookingSchema>;

export const paymentSchema = Yup.object({
  amount: Yup.number().typeError("Enter an amount").moreThan(0, "Enter an amount").required("Amount is required"),
  mode: Yup.string().oneOf(Object.keys(PAYMENT_MODES), "Choose a mode").required(),
  reference: optionalText("Reference", 60),
  paidBy: Yup.string().oneOf(["guest", "agent"]).default("guest"),
});
export type PaymentInput = Yup.InferType<typeof paymentSchema>;

export const cancelSchema = Yup.object({
  reason: requiredText("Reason", 300),
  noShow: Yup.boolean().default(false),
});
export type CancelInput = Yup.InferType<typeof cancelSchema>;

export const checkOutSchema = Yup.object({
  allowDue: Yup.boolean().default(false),
  at: momentField,
});

export const checkInSchema = Yup.object({ at: momentField });

/** Edit the price of a booking: meal plan, rate basis, per-head rate, discount */
export const rateSchema = Yup.object({
  mealPlan: Yup.string().oneOf(MEAL_PLAN_CODES, "Choose a meal plan").required(),
  rateType: Yup.string().oneOf(["room", "per_head"]).default("room"),
  perHeadRate: Yup.number()
    .typeError("Enter a number")
    .min(0, "Cannot be negative")
    .default(0)
    .when("rateType", { is: "per_head", then: (s) => s.moreThan(0, "Enter the per-head rate") }),
  focPax: Yup.number().typeError("Enter a number").integer().min(0, "Cannot be negative").default(0),
  discountPercent: Yup.number().typeError("Enter a number").min(0, "Cannot be negative").max(100, "At most 100%").nullable().default(null),
});
export type RateInput = Yup.InferType<typeof rateSchema>;
