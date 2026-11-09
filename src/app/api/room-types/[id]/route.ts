import { roomTypeSchema } from "@/lib/validation/hotel.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteRoomType, getRoomType, updateRoomType } from "@/server/services/room.service";

export const GET = apiHandler<{ id: string }>({ module: "room_type", action: "view" }, async ({ params, user }) => getRoomType(params.id, user));

export const PUT = apiHandler<{ id: string }>({ module: "room_type", action: "update" }, async ({ req, params, user }) =>
  updateRoomType(params.id, await readBody(req, roomTypeSchema), user)
);

export const DELETE = apiHandler<{ id: string }>({ module: "room_type", action: "delete" }, async ({ params, user }) => {
  await deleteRoomType(params.id, user);
  return { success: true };
});
