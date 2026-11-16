import { apiHandler } from "@/server/http/handler";
import { undoCheckIn } from "@/server/services/booking/bookingActions";

/** Undo a mistaken check-in: back to Confirmed */
export const POST = apiHandler<{ id: string }>({ module: "check_in_out", action: "update" }, async ({ params, user }) => undoCheckIn(params.id, user));
