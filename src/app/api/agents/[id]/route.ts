import { hotelScope } from "@/server/auth/session";
import { agentSchema } from "@/lib/validation/agent.schema";
import { apiHandler, readBody } from "@/server/http/handler";
import { deleteAgent, getAgent, updateAgent } from "@/server/services/agent.service";

export const GET = apiHandler<{ id: string }>({ module: "agent", action: "view" }, async ({ params, user }) => getAgent(params.id, hotelScope(user)));

export const PUT = apiHandler<{ id: string }>({ module: "agent", action: "update" }, async ({ req, params }) =>
  updateAgent(params.id, await readBody(req, agentSchema))
);

export const DELETE = apiHandler<{ id: string }>({ module: "agent", action: "delete" }, async ({ params }) => {
  await deleteAgent(params.id);
  return { success: true };
});
