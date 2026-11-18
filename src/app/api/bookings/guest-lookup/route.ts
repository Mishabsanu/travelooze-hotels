import { canBooking } from "@/lib/bookingAccess";
import { AppError } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { findReturningGuest } from "@/server/services/booking/guestLookup";

/** GET /api/bookings/guest-lookup?phone=98XXXXXXXX → { guest } of the latest booking with that phone, or null */
export const GET = apiHandler("authenticated", async ({ req, user }) => {
  if (!canBooking(user, "walkin", "create") && !canBooking(user, "agent", "create")) {
    throw new AppError("You do not have permission to create bookings", 403);
  }
  return { guest: await findReturningGuest(req.nextUrl.searchParams.get("phone") ?? "", user) };
});
