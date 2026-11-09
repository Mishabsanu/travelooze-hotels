import { hotelSchema } from "@/lib/validation/hotel.schema";
import { can } from "@/lib/permissions";
import { AppError } from "@/server/http/errors";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createHotel, listHotelOptions, listHotels } from "@/server/services/hotel.service";

export const GET = apiHandler("authenticated", async ({ req, user }) => {
  const params = req.nextUrl.searchParams;
  // Dropdown options are needed by bookings / rooms screens too (still limited to the user's hotels)
  if (params.get("options") === "1") return { options: await listHotelOptions(user) };
  if (!can(user, "hotel", "view")) throw new AppError("You do not have permission to perform this action", 403);
  return listHotels(parseListQuery(params, ["category"]), user);
});

export const POST = apiHandler({ module: "hotel", action: "create" }, async ({ req, user }) =>
  createHotel(await readBody(req, hotelSchema), user)
);
