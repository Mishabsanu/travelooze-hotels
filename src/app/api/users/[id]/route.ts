import { updateUserSchema } from "@/lib/validation/user.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteUser, getUser, updateUser } from "@/server/services/user.service";

export const GET = apiHandler<{ id: string }>({ module: "user", action: "view" }, async ({ params }) => getUser(params.id));

export const PUT = apiHandler<{ id: string }>({ module: "user", action: "update" }, async ({ req, params, user }) => {
  const input = await readBody(req, updateUserSchema);
  return updateUser(params.id, input, user);
});

export const DELETE = apiHandler<{ id: string }>({ module: "user", action: "delete" }, async ({ params, user }) => {
  await deleteUser(params.id, user);
  return { success: true };
});
