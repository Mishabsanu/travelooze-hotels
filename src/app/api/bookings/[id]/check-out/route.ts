import { checkOutSchema } from "@/lib/validation/booking.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { checkOutBooking } from "@/server/services/booking/bookingActions";

export const POST = apiHandler<{ id: string }>({ module: "check_in_out", action: "update" }, async ({ req, params, user }) => {
  const { allowDue } = await readBody(req, checkOutSchema);
  return checkOutBooking(params.id, allowDue, user);
});
