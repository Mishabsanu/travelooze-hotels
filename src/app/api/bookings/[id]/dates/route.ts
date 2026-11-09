import { datesSchema } from "@/lib/validation/booking.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { changeDates } from "@/server/services/booking/changes";

/** Change stay dates / extend stay (permission checked in the service) */
export const POST = apiHandler<{ id: string }>("authenticated", async ({ req, params, user }) =>
  changeDates(params.id, await readBody(req, datesSchema), user)
);
