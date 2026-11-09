import { model, models, Schema, type Model, type Types } from "mongoose";
import { ROOM_STATUS, type RoomStatus } from "@/lib/constants";
import type { RecordStatus } from "@/lib/types";

export interface RoomDoc {
  _id: Types.ObjectId;
  hotel: Types.ObjectId;
  roomType: Types.ObjectId;
  number: string;
  floor: string;
  /** Housekeeping: clean / cleaning / maintenance (maintenance rooms cannot be sold) */
  housekeeping: RoomStatus;
  status: RecordStatus;
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<RoomDoc>(
  {
    hotel: { type: Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },
    roomType: { type: Schema.Types.ObjectId, ref: "RoomType", required: true, index: true },
    number: { type: String, required: true, trim: true },
    floor: { type: String, default: "", trim: true },
    housekeeping: { type: String, enum: Object.keys(ROOM_STATUS), default: "available" },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  },
  { timestamps: true }
);
RoomSchema.index({ hotel: 1, number: 1 }, { unique: true });

export const Room: Model<RoomDoc> = (models.Room as Model<RoomDoc>) || model<RoomDoc>("Room", RoomSchema);
