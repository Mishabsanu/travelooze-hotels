import * as Yup from "yup";
import { MEAL_PLAN_CODES, PAYMENT_MODES } from "../constants";
import { objectId, optionalText, requiredPhone, requiredText } from "./common";

const day = (label: string) => Yup.string().required(`${label} is required`).matches(/^\d{4}-\d{2}-\d{2}$/, `${label} is invalid`);

export const bookingSchema = Yup.object({
  source: Yup.string().oneOf(["walkin", "agent"]).required(),
  hotel: objectId("Hotel"),
  agent: Yup.string()
    .default("")
    .when("source", { is: "agent", then: (s) => s.required("Choose an agent").matches(/^[a-f0-9]{24}$/i, "Choose an agent") }),
  agentRef: optionalText("Agent reference", 60),
  billTo: Yup.string().oneOf(["guest", "agent"]).default("guest"),
  checkIn: day("Check-in"),
  checkOut: day("Check-out").test("after", "Check-out must be after check-in", function (v) {
    return !v || !this.parent.checkIn || v > this.parent.checkIn;
  }),
  mealPlan: Yup.string().oneOf(MEAL_PLAN_CODES, "Choose a meal plan").required(),
  rooms: Yup.array().of(Yup.string().required()).min(1, "Select at least one room").required(),
  adults: Yup.number().typeError("Enter a number").integer().min(1, "At least 1 adult").required(),
  children: Yup.number().typeError("Enter a number").integer().min(0).default(0),
  guestName: requiredText("Guest name", 100),
  phone: requiredPhone("Phone"),
  address: optionalText("Address", 300),
  aadhaar: Yup.string()
    .default("")
    .test("aadhaar", "Aadhaar must be 12 digits", (v) => !v || v.replace(/\D/g, "").length === 12),
  discountPercent: Yup.number().typeError("Enter a number").min(0).max(100).default(0),
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
});
