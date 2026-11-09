import { roomingSchema } from "@/lib/validation/booking.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { updateRooming } from "@/server/services/booking/rooming";

/** Rooming list: guest names per room; occupancy / extra beds (re-prices) for people who may edit the booking. */
export const PUT = apiHandler<{ id: string }>("authenticated", async ({ req, params, user }) =>
  updateRooming(params.id, await readBody(req, roomingSchema), user)
);
