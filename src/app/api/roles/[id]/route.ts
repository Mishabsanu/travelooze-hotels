import { roleSchema } from "@/lib/validation/role.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteRole, getRole, updateRole } from "@/server/services/role.service";

export const GET = apiHandler<{ id: string }>({ module: "role", action: "view" }, async ({ params }) => getRole(params.id));

export const PUT = apiHandler<{ id: string }>({ module: "role", action: "update" }, async ({ req, params, user }) => {
  const input = await readBody(req, roleSchema);
  return updateRole(params.id, input, user);
});

export const DELETE = apiHandler<{ id: string }>({ module: "role", action: "delete" }, async ({ params }) => {
  await deleteRole(params.id);
  return { success: true };
});
