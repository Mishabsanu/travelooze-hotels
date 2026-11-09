import { checkInSchema } from "@/lib/validation/booking.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { checkInBooking } from "@/server/services/booking/bookingActions";

/** Body (optional): { at: "YYYY-MM-DDTHH:mm" } actual check-in time in IST; blank = now */
export const POST = apiHandler<{ id: string }>({ module: "check_in_out", action: "update" }, async ({ req, params, user }) => {
  const { at } = await readBody(req, checkInSchema);
  return checkInBooking(params.id, user, at);
});
