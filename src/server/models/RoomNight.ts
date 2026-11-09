import { model, models, Schema, type Model, type Types } from "mongoose";

export interface RoomNightDoc {
  _id: Types.ObjectId;
  room: Types.ObjectId;
  date: Date;
  hotel: Types.ObjectId;
  booking: Types.ObjectId;
}

/**
 * One document per room per night held by a booking. The unique (room, date) index makes
 * double-booking impossible at the database level, even when two people book at the same moment.
 */
const RoomNightSchema = new Schema<RoomNightDoc>({
  room: { type: Schema.Types.ObjectId, ref: "Room", required: true },
  date: { type: Date, required: true },
  hotel: { type: Schema.Types.ObjectId, ref: "Hotel", required: true },
  booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
});
RoomNightSchema.index({ room: 1, date: 1 }, { unique: true });
RoomNightSchema.index({ hotel: 1, date: 1 });

export const RoomNight: Model<RoomNightDoc> =
  (models.RoomNight as Model<RoomNightDoc>) || model<RoomNightDoc>("RoomNight", RoomNightSchema);
