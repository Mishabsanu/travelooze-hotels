import { apiHandler } from "@/server/http/handler";
import { listBin } from "@/server/services/booking/bookingActions";

/** Recycle bin: deleted bookings */
export const GET = apiHandler("authenticated", async ({ user }) => ({ items: await listBin(user) }));
