import { model, models, Schema, type Model } from "mongoose";

interface CounterDoc {
  _id: string;
  seq: number;
  model?: string;
}

const CounterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
  model: { type: String },
});

export const counterModelKey = (key: string) => `hotel:${key}`;

export const Counter: Model<CounterDoc> =
  (models.Counter as Model<CounterDoc>) || model<CounterDoc>("Counter", CounterSchema);

/** Atomically returns the next formatted code, e.g. CUS-0001. */
export async function nextCode(key: string, prefix: string, pad = 4): Promise<string> {
  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 }, $set: { model: counterModelKey(key) } },
    { upsert: true, returnDocument: "after" }
  ).lean();
  return `${prefix}-${String(counter!.seq).padStart(pad, "0")}`;
}
