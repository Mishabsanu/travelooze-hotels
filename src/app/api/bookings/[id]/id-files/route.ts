import { apiHandler } from "@/server/http/handler";
import { addIdFiles } from "@/server/services/booking/bookingActions";

/** multipart/form-data: files (1–6), aadhaar (optional 12 digits) */
export const POST = apiHandler<{ id: string }>({ module: "guest_id", action: "create" }, async ({ req, params, user }) => {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  return addIdFiles(params.id, files, String(form.get("aadhaar") ?? ""), user);
});
