import { rateSchema } from "@/lib/validation/booking.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { changeRate } from "@/server/services/booking/changes";

/** Change meal plan / rate basis / discount of a booking (permission checked in the service) */
export const POST = apiHandler<{ id: string }>("authenticated", async ({ req, params, user }) =>
  changeRate(params.id, await readBody(req, rateSchema), user)
);
