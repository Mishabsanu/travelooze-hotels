import { apiHandler } from "@/server/http/handler";

export const GET = apiHandler("authenticated", async ({ user }) => ({ user }));
