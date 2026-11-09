import { NextResponse } from "next/server";
import { AppError } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { getBooking } from "@/server/services/booking/booking.service";
import { guestFileRef } from "@/server/services/booking/rooming";
import { readIdFile } from "@/server/storage";

/** Streams one guest's ID file from private Cloudinary storage (guest_id view + hotel access). */
export const GET = apiHandler<{ id: string; guestId: string; index: string }>({ module: "guest_id", action: "view" }, async ({ params, user }) => {
  if (!/^\d+$/.test(params.index)) throw new AppError("File not found", 404);
  const ref = guestFileRef(await getBooking(params.id, user), params.guestId, Number(params.index));
  if (!ref) throw new AppError("File not found", 404);
  const file = await readIdFile(ref);
  return new NextResponse(new Uint8Array(file.data), {
    headers: { "Content-Type": file.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
  });
});
