import { apiHandler } from "@/server/http/handler";
import { checkInBooking } from "@/server/services/booking/bookingActions";

export const POST = apiHandler<{ id: string }>({ module: "check_in_out", action: "update" }, async ({ params, user }) =>
  checkInBooking(params.id, user)
);
