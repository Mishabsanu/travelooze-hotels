import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import * as Yup from "yup";
import { HOTEL_COOKIE } from "@/server/auth/token";
import { AppError } from "@/server/http/errors";
import { apiHandler, readBody } from "@/server/http/handler";
import { Hotel } from "@/server/models/Hotel";

const schema = Yup.object({ hotel: Yup.string().default("") });

/** Header hotel switcher: "" = all my hotels, otherwise one hotel the user is assigned to. */
export const POST = apiHandler("authenticated", async ({ req, user }) => {
  const { hotel } = await readBody(req, schema);
  const res = NextResponse.json({ success: true, hotel: hotel || null });
  if (!hotel) {
    res.cookies.set(HOTEL_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
  if (!isValidObjectId(hotel) || !(user.assignedAll || user.assignedHotelIds.includes(hotel))) {
    throw new AppError("You are not assigned to this hotel", 403);
  }
  if (!(await Hotel.exists({ _id: hotel, status: "active" }))) throw new AppError("Hotel not found or inactive", 404);
  res.cookies.set(HOTEL_COOKIE, hotel, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180,
  });
  return res;
});
