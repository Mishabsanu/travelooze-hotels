import { model, models, Schema, type Model, type Types } from "mongoose";
import { MEAL_PLAN_CODES, type MealPlan } from "@/lib/constants";
import type { RecordStatus } from "@/lib/types";

export interface RoomTypeDoc {
  _id: Types.ObjectId;
  hotel: Types.ObjectId;
  name: string;
  maxAdults: number;
  /** Children allowed in the room (on top of adults) */
  maxChildren: number;
  /** Extra beds allowed; each extra bed adds one more adult */
  maxExtraBeds: number;
  /** Rack rate per room per night for each meal plan (before GST) */
  rates: Record<MealPlan, number>;
  /** Extra bed rate per bed per night for each meal plan (food included in MAP / AP) */
  extraBedRates: Record<MealPlan, number>;
  status: RecordStatus;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RatesSchema = new Schema(
  Object.fromEntries(MEAL_PLAN_CODES.map((c) => [c, { type: Number, default: 0, min: 0 }])),
  { _id: false }
);

const RoomTypeSchema = new Schema<RoomTypeDoc>(
  {
    hotel: { type: Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },
    name: { type: String, required: true, trim: true },
    maxAdults: { type: Number, default: 2, min: 1 },
    maxChildren: { type: Number, default: 2, min: 0 },
    maxExtraBeds: { type: Number, default: 1, min: 0 },
    rates: { type: RatesSchema, default: () => ({}) },
    extraBedRates: { type: RatesSchema, default: () => ({}) },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
RoomTypeSchema.index({ hotel: 1, name: 1 }, { unique: true });

export const RoomType: Model<RoomTypeDoc> =
  (models.RoomType as Model<RoomTypeDoc>) || model<RoomTypeDoc>("RoomType", RoomTypeSchema);
