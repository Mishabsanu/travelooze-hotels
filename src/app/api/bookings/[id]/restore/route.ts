import { apiHandler } from "@/server/http/handler";
import { purgeBooking, restoreBooking } from "@/server/services/booking/bookingActions";

/** Restore from the recycle bin */
export const POST = apiHandler<{ id: string }>("authenticated", async ({ params, user }) => restoreBooking(params.id, user));

/** Delete forever (Super Admin) */
export const DELETE = apiHandler<{ id: string }>("authenticated", async ({ params, user }) => {
  await purgeBooking(params.id, user);
  return { ok: true };
});
