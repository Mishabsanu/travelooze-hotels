import { moveSchema } from "@/lib/validation/booking.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { moveRoom } from "@/server/services/booking/changes";

/** Move one booked room to another room (permission checked in the service) */
export const POST = apiHandler<{ id: string }>("authenticated", async ({ req, params, user }) =>
  moveRoom(params.id, await readBody(req, moveSchema), user)
);
