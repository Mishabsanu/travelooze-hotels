import { canBooking } from "@/lib/bookingAccess";
import { AppError } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { getAvailability } from "@/server/services/booking/availability";
import { assertHotelAccess } from "@/server/services/hotel.service";
import { nightsBetween, parseDay } from "@/server/services/stay";

/** GET /api/bookings/availability?hotel=..&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD */
export const GET = apiHandler("authenticated", async ({ req, user }) => {
  if (!canBooking(user, "walkin", "create") && !canBooking(user, "agent", "create")) {
    throw new AppError("You do not have permission to create bookings", 403);
  }
  const p = req.nextUrl.searchParams;
  const hotel = p.get("hotel") || "";
  assertHotelAccess(user, hotel);
  const checkIn = parseDay(p.get("checkIn") || "");
  const checkOut = parseDay(p.get("checkOut") || "");
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) throw new AppError("Check-out must be after check-in", 422);
  return { nights, types: await getAvailability(hotel, checkIn, checkOut) };
});
