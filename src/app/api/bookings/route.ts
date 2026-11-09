import { canListBookings } from "@/lib/bookingAccess";
import { bookingSchema } from "@/lib/validation/booking.schema";
import { AppError } from "@/server/http/errors";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createBooking, listBookings } from "@/server/services/booking/booking.service";

const FILTERS = ["hotel", "source", "agent", "mealPlan", "stay", "date"];

export const GET = apiHandler("authenticated", async ({ req, user }) => {
  if (!canListBookings(user)) throw new AppError("You do not have permission to perform this action", 403);
  return listBookings(parseListQuery(req.nextUrl.searchParams, FILTERS), user);
});

/** Permission (walk-in vs agent) is checked inside the service, per booking source. */
export const POST = apiHandler("authenticated", async ({ req, user }) => createBooking(await readBody(req, bookingSchema), user));
