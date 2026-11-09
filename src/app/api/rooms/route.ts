import { roomCreateSchema } from "@/lib/validation/hotel.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createRooms, listRooms } from "@/server/services/room.service";

export const GET = apiHandler({ module: "room", action: "view" }, async ({ req, user }) =>
  listRooms(parseListQuery(req.nextUrl.searchParams, ["hotel", "roomType", "housekeeping"]), user)
);

export const POST = apiHandler({ module: "room", action: "create" }, async ({ req, user }) =>
  createRooms(await readBody(req, roomCreateSchema), user)
);
