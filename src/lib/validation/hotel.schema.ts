import * as Yup from "yup";
import { HOTEL_CATEGORIES, MEAL_PLAN_CODES, ROOM_STATUS, type MealPlan } from "../constants";
import { overlappingSeasons } from "../seasonRates";
import { objectId, optionalEmail, optionalText, requiredText, statusField } from "./common";

const GSTIN = /^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const hotelSchema = Yup.object({
  code: Yup.string()
    .trim()
    .uppercase()
    .required("Code is required")
    .matches(/^[A-Z0-9]{2,6}$/, "2–6 letters / digits, e.g. GRD"),
  name: requiredText("Hotel name", 120),
  category: Yup.string().oneOf(Object.keys(HOTEL_CATEGORIES), "Choose a category").required("Category is required"),
  address: optionalText("Address", 300),
  phone: optionalText("Phone", 30),
  email: optionalEmail("Email"),
  gstin: Yup.string().trim().uppercase().default("").matches(GSTIN, "GSTIN must be 15 characters, e.g. 32ABCDE1234F1Z5"),
  checkInTime: Yup.string().default("12:00").matches(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM, e.g. 12:00"),
  checkOutTime: Yup.string().default("11:00").matches(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM, e.g. 11:00"),
  status: statusField,
});
export type HotelInput = Yup.InferType<typeof hotelSchema>;
export const emptyHotel: HotelInput = {
  code: "",
  name: "",
  category: "standard",
  address: "",
  phone: "",
  email: "",
  gstin: "",
  checkInTime: "12:00",
  checkOutTime: "11:00",
  status: "active",
};

const rate = (plan: string) => Yup.number().typeError(`${plan} rate must be a number`).min(0, "Cannot be negative").required(`${plan} rate is required`);

const bedRate = () => Yup.number().typeError("Enter a number").min(0, "Cannot be negative").default(0);

const ymd = (label: string) => Yup.string().required(`${label} is required`).matches(/^\d{4}-\d{2}-\d{2}$/, `Pick the ${label.toLowerCase()}`);

/** Peak / off season: its own rates between two dates (0 = normal rate for that plan) */
export const seasonSchema = Yup.object({
  _id: Yup.string().default(""),
  name: requiredText("Season name", 40),
  from: ymd("From date"),
  to: ymd("To date").test("after", "Must be on or after the from date", function (v) {
    return !v || !this.parent.from || this.parent.yearly || v >= this.parent.from;
  }),
  yearly: Yup.boolean().default(false),
  rates: Yup.object(Object.fromEntries(MEAL_PLAN_CODES.map((c) => [c, bedRate()])) as Record<MealPlan, ReturnType<typeof bedRate>>),
  extraBedRates: Yup.object(Object.fromEntries(MEAL_PLAN_CODES.map((c) => [c, bedRate()])) as Record<MealPlan, ReturnType<typeof bedRate>>),
});
export type SeasonInput = Yup.InferType<typeof seasonSchema>;
export const emptySeason: SeasonInput = {
  _id: "",
  name: "",
  from: "",
  to: "",
  yearly: false,
  rates: { EP: 0, CP: 0, MAP: 0, AP: 0 },
  extraBedRates: { EP: 0, CP: 0, MAP: 0, AP: 0 },
};

export const roomTypeSchema = Yup.object({
  hotel: objectId("Hotel"),
  name: requiredText("Room type", 60),
  maxAdults: Yup.number().typeError("Enter a number").integer().min(1, "At least 1").max(10).required("Max adults is required"),
  maxChildren: Yup.number().typeError("Enter a number").integer().min(0).max(10).default(2),
  maxExtraBeds: Yup.number().typeError("Enter a number").integer().min(0).max(5).default(1),
  rates: Yup.object(Object.fromEntries(MEAL_PLAN_CODES.map((c) => [c, rate(c)])) as Record<MealPlan, ReturnType<typeof rate>>),
  extraBedRates: Yup.object(Object.fromEntries(MEAL_PLAN_CODES.map((c) => [c, bedRate()])) as Record<MealPlan, ReturnType<typeof bedRate>>),
  seasons: Yup.array()
    .of(seasonSchema)
    .max(20, "At most 20 seasons")
    .default([])
    .test("overlap", "Two seasons share dates", function (list) {
      const hit = overlappingSeasons(list ?? []);
      return hit ? this.createError({ message: `Seasons "${hit[0]}" and "${hit[1]}" share dates. Make them not overlap.` }) : true;
    }),
  status: statusField,
});
export type RoomTypeInput = Yup.InferType<typeof roomTypeSchema>;
export const emptyRoomType: RoomTypeInput = {
  hotel: "",
  name: "",
  maxAdults: 2,
  maxChildren: 2,
  maxExtraBeds: 1,
  rates: { EP: 0, CP: 0, MAP: 0, AP: 0 },
  extraBedRates: { EP: 0, CP: 0, MAP: 0, AP: 0 },
  seasons: [],
  status: "active",
};

/** Accepts "101-110", "201, 202, 205" or a mix like "101-105, 110". */
export function parseRoomNumbers(input: string): string[] {
  const out: string[] = [];
  for (const part of input.split(",").map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const [a, b] = [Number(m[1]), Number(m[2])];
      if (b < a || b - a > 200) throw new Error(`Bad range ${part}`);
      for (let i = a; i <= b; i++) out.push(String(i));
    } else out.push(part);
  }
  return [...new Set(out)];
}

export const roomCreateSchema = Yup.object({
  hotel: objectId("Hotel"),
  roomType: objectId("Room type"),
  numbers: Yup.string()
    .trim()
    .required("Room numbers are required")
    .test("numbers", "Use numbers or ranges like 101-110, 115", (v) => {
      try {
        const list = parseRoomNumbers(v || "");
        return list.length > 0 && list.length <= 200 && list.every((n) => /^[A-Za-z0-9-]{1,10}$/.test(n));
      } catch {
        return false;
      }
    }),
  floor: optionalText("Floor", 20),
});
export type RoomCreateInput = Yup.InferType<typeof roomCreateSchema>;
export const emptyRoomCreate: RoomCreateInput = { hotel: "", roomType: "", numbers: "", floor: "" };

export const roomUpdateSchema = Yup.object({
  roomType: objectId("Room type"),
  number: requiredText("Room number", 10),
  floor: optionalText("Floor", 20),
  housekeeping: Yup.string().oneOf(Object.keys(ROOM_STATUS)).required(),
  status: statusField,
});
export type RoomUpdateInput = Yup.InferType<typeof roomUpdateSchema>;
