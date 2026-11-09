import { NextResponse } from "next/server";
import { AppError } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { getBooking } from "@/server/services/booking/booking.service";
import { readIdFile } from "@/server/storage";

/** Streams an Aadhaar / ID file to staff holding guest_id view for that hotel. Never cached. */
export const GET = apiHandler<{ id: string; name: string }>({ module: "guest_id", action: "view" }, async ({ params, user }) => {
  const booking = await getBooking(params.id, user);
  if (!booking.guest.idFiles.includes(params.name)) throw new AppError("File not found", 404);
  const file = await readIdFile(params.name);
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
});
