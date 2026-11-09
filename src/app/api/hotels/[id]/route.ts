import { hotelSchema } from "@/lib/validation/hotel.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteHotel, getHotel, updateHotel } from "@/server/services/hotel.service";

export const GET = apiHandler<{ id: string }>({ module: "hotel", action: "view" }, async ({ params, user }) => getHotel(params.id, user));

export const PUT = apiHandler<{ id: string }>({ module: "hotel", action: "update" }, async ({ req, params, user }) =>
  updateHotel(params.id, await readBody(req, hotelSchema), user)
);

export const DELETE = apiHandler<{ id: string }>({ module: "hotel", action: "delete" }, async ({ params, user }) => {
  await deleteHotel(params.id, user);
  return { success: true };
});
