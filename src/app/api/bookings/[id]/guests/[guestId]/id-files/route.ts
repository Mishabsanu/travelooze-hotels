import { apiHandler } from "@/server/http/handler";
import { addGuestIdFiles } from "@/server/services/booking/rooming";

/** multipart/form-data: files (1–4), aadhaar (optional 12 digits) for ONE guest of the rooming list */
export const POST = apiHandler<{ id: string; guestId: string }>({ module: "guest_id", action: "create" }, async ({ req, params, user }) => {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  return addGuestIdFiles(params.id, params.guestId, files, String(form.get("aadhaar") ?? ""), user);
});
