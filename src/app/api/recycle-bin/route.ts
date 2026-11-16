import { AppError } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { BIN_MODULES, type BinModule, listBinItems } from "@/server/services/recycleBin.service";

/** Items in the recycle bin of one module */
export const GET = apiHandler("authenticated", async ({ req, user }) => {
  const which = new URL(req.url).searchParams.get("module") as BinModule;
  if (!BIN_MODULES.includes(which)) throw new AppError("Unknown module", 400);
  return { items: await listBinItems(user, which) };
});
