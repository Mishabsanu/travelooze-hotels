import { paymentSchema } from "@/lib/validation/booking.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { addPayment } from "@/server/services/booking/bookingActions";

export const POST = apiHandler<{ id: string }>({ module: "payment", action: "create" }, async ({ req, params, user }) =>
  addPayment(params.id, await readBody(req, paymentSchema), user)
);
