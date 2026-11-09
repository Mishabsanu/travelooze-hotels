import { model, models, Schema, type Model, type Types } from "mongoose";
import { HOTEL_CATEGORIES, type HotelCategory } from "@/lib/constants";
import type { RecordStatus } from "@/lib/types";

export interface HotelDoc {
  _id: Types.ObjectId;
  code: string;
  name: string;
  category: HotelCategory;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  status: RecordStatus;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const HotelSchema = new Schema<HotelDoc>(
  {
    // Short code used in booking numbers, e.g. GRD-00012
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: Object.keys(HOTEL_CATEGORIES), required: true },
    address: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    gstin: { type: String, default: "", trim: true, uppercase: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Hotel: Model<HotelDoc> = (models.Hotel as Model<HotelDoc>) || model<HotelDoc>("Hotel", HotelSchema);
