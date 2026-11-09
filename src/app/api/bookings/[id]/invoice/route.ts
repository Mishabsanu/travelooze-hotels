import { apiHandler } from "@/server/http/handler";
import { issueInvoice } from "@/server/services/booking/invoice.service";

/** Assigns the GST invoice number (once) */
export const POST = apiHandler<{ id: string }>({ module: "payment", action: "create" }, async ({ params, user }) => issueInvoice(params.id, user));
