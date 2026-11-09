import { createUserSchema } from "@/lib/validation/user.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createUser, listUsers } from "@/server/services/user.service";

export const GET = apiHandler({ module: "user", action: "view" }, async ({ req }) =>
  listUsers(parseListQuery(req.nextUrl.searchParams, ["role"]))
);

export const POST = apiHandler({ module: "user", action: "create" }, async ({ req, user }) => {
  const input = await readBody(req, createUserSchema);
  return createUser(input, user);
});
