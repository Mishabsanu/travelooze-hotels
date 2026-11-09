import { cancelSchema } from "@/lib/validation/booking.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { cancelBooking } from "@/server/services/booking/bookingActions";

/** Permission (booking vs agent_booking delete) is checked in the service by booking source. */
export const POST = apiHandler<{ id: string }>("authenticated", async ({ req, params, user }) =>
  cancelBooking(params.id, await readBody(req, cancelSchema), user)
);
