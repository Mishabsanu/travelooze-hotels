import { agentSchema } from "@/lib/validation/agent.schema";
import { can } from "@/lib/permissions";
import { AppError } from "@/server/http/errors";
import { apiHandler, readBody } from "@/server/http/handler";
import { parseListQuery } from "@/server/http/query";
import { createAgent, listAgentOptions, listAgents } from "@/server/services/agent.service";

export const GET = apiHandler("authenticated", async ({ req, user }) => {
  const params = req.nextUrl.searchParams;
  // Booking screens need the agent dropdown even without the agent master permission
  if (params.get("options") === "1" && (can(user, "agent", "view") || can(user, "agent_booking", "create"))) {
    return { options: await listAgentOptions() };
  }
  if (!can(user, "agent", "view")) throw new AppError("You do not have permission to perform this action", 403);
  return listAgents(parseListQuery(params));
});

export const POST = apiHandler({ module: "agent", action: "create" }, async ({ req, user }) =>
  createAgent(await readBody(req, agentSchema), user)
);
