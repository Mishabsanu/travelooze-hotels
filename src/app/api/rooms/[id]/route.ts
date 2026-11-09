import * as Yup from "yup";
import { ROOM_STATUS } from "@/lib/constants";
import { roomUpdateSchema } from "@/lib/validation/hotel.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteRoom, getRoom, setHousekeeping, updateRoom } from "@/server/services/room.service";

const housekeepingSchema = Yup.object({ housekeeping: Yup.string().oneOf(Object.keys(ROOM_STATUS)).required() });

export const GET = apiHandler<{ id: string }>({ module: "room", action: "view" }, async ({ params, user }) => getRoom(params.id, user));

export const PUT = apiHandler<{ id: string }>({ module: "room", action: "update" }, async ({ req, params, user }) =>
  updateRoom(params.id, await readBody(req, roomUpdateSchema), user)
);

/** Housekeeping status only (clean / cleaning / maintenance) */
export const PATCH = apiHandler<{ id: string }>({ module: "room", action: "update" }, async ({ req, params, user }) => {
  const { housekeeping } = await readBody(req, housekeepingSchema);
  return setHousekeeping(params.id, housekeeping, user);
});

export const DELETE = apiHandler<{ id: string }>({ module: "room", action: "delete" }, async ({ params, user }) => {
  await deleteRoom(params.id, user);
  return { success: true };
});
