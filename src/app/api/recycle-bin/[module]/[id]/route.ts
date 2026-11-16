import { AppError } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { BIN_MODULES, type BinModule, purgeItem, restoreItem } from "@/server/services/recycleBin.service";

const mod = (m: string) => {
  if (!BIN_MODULES.includes(m as BinModule)) throw new AppError("Unknown module", 400);
  return m as BinModule;
};

/** Restore from the recycle bin */
export const POST = apiHandler<{ module: string; id: string }>("authenticated", async ({ params, user }) => {
  await restoreItem(user, mod(params.module), params.id);
  return { ok: true };
});

/** Delete forever (Super Admin) */
export const DELETE = apiHandler<{ module: string; id: string }>("authenticated", async ({ params, user }) => {
  await purgeItem(user, mod(params.module), params.id);
  return { ok: true };
});
