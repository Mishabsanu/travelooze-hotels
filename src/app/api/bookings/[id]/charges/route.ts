import { chargeSchema } from "@/lib/validation/booking.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { addCharge } from "@/server/services/booking/changes";

/** Folio: add an extra charge (restaurant, laundry, …) */
export const POST = apiHandler<{ id: string }>({ module: "payment", action: "create" }, async ({ req, params, user }) =>
  addCharge(params.id, await readBody(req, chargeSchema), user)
);
