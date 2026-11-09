import { model, models, Schema, type Model, type Types } from "mongoose";
import type { RecordStatus } from "@/lib/types";

export interface AgentDoc {
  _id: Types.ObjectId;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  /** Contract discount applied automatically on rack rate */
  discountPercent: number;
  /** 0 = prepaid agent (no credit) */
  creditLimit: number;
  status: RecordStatus;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<AgentDoc>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, default: "", trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    address: { type: String, default: "", trim: true },
    gstin: { type: String, default: "", trim: true, uppercase: true },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    creditLimit: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Agent: Model<AgentDoc> = (models.Agent as Model<AgentDoc>) || model<AgentDoc>("Agent", AgentSchema);
