import "server-only";
import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var hotelMongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.hotelMongoose ?? { conn: null, promise: null };
global.hotelMongoose = cached;

/** One shared connection per server process (survives dev hot reloads). */
export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env.local.");

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
    });
  }

  try {
    cached.conn = await cached.promise;
    // The unique (room, date) index is what blocks double booking: make sure it exists
    const { RoomNight } = await import("./models/RoomNight");
    await RoomNight.createIndexes();
  } catch (error) {
    cached.promise = null;
    throw error;
  }
  return cached.conn;
}
