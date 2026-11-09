import { model, models, Schema, type Model, type Types } from "mongoose";
import type { RecordStatus } from "@/lib/types";

export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: Types.ObjectId;
  status: RecordStatus;
  /** Works at every hotel; otherwise only at `hotels` */
  allHotels: boolean;
  hotels: Types.ObjectId[];
  lastLoginAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    // Never returned unless explicitly selected
    password: { type: String, required: true, select: false },
    role: { type: Schema.Types.ObjectId, ref: "Role", required: true, index: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    allHotels: { type: Boolean, default: false },
    hotels: [{ type: Schema.Types.ObjectId, ref: "Hotel" }],
    lastLoginAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

UserSchema.index({ createdAt: -1 });

export const User: Model<UserDoc> = (models.User as Model<UserDoc>) || model<UserDoc>("User", UserSchema);
