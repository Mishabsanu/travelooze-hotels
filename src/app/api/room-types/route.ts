import { roomTypeSchema } from "@/lib/validation/hotel.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createRoomType, listRoomTypeOptions, listRoomTypes } from "@/server/services/room.service";

export const GET = apiHandler({ module: "room_type", action: "view" }, async ({ req, user }) => {
  const params = req.nextUrl.searchParams;
  if (params.get("options") === "1") return { options: await listRoomTypeOptions(user, params.get("hotel") || undefined) };
  return listRoomTypes(parseListQuery(params, ["hotel"]), user);
});

export const POST = apiHandler({ module: "room_type", action: "create" }, async ({ req, user }) =>
  createRoomType(await readBody(req, roomTypeSchema), user)
);
