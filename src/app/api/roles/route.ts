import { roleSchema } from "@/lib/validation/role.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createRole, listRoleOptions, listRoles } from "@/server/services/role.service";

export const GET = apiHandler({ module: "role", action: "view" }, async ({ req }) => {
  const params = req.nextUrl.searchParams;
  if (params.get("options") === "1") return { options: await listRoleOptions() };
  return listRoles(parseListQuery(params));
});

export const POST = apiHandler({ module: "role", action: "create" }, async ({ req, user }) => {
  const input = await readBody(req, roleSchema);
  return createRole(input, user);
});
