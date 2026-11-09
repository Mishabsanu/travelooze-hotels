import { apiHandler } from "@/server/http/handler";
import { removeCharge } from "@/server/services/booking/changes";

/** Folio: remove a wrongly entered charge */
export const DELETE = apiHandler<{ id: string; chargeId: string }>({ module: "payment", action: "delete" }, async ({ params, user }) =>
  removeCharge(params.id, params.chargeId, user)
);
