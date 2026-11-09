import "server-only";
import { canListBookings } from "@/lib/bookingAccess";
import type { Booking } from "@/lib/hotelTypes";
import { financialYear } from "@/lib/invoice";
import { can } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { AppError } from "../../http/errors";
import { Booking as BookingModel } from "../../models/Booking";
import { nextCode } from "../../models/Counter";
import { getBooking } from "./booking.service";

/**
 * Gives the booking its GST invoice number once (per hotel, per financial year), e.g. GRD/2026-27-0001.
 * Re-printing never creates a new number.
 */
export async function issueInvoice(id: string, user: SessionUser): Promise<Booking> {
  if (!canListBookings(user) || !can(user, "payment", "create")) throw new AppError("You do not have permission to issue invoices", 403);
  const b = await getBooking(id, user);
  if (b.invoiceNo) return b;
  if (b.status === "cancelled") throw new AppError("A cancelled booking has no invoice", 409);
  const fy = financialYear(new Date());
  const code = b.hotel?.code ?? "INV";
  const invoiceNo = await nextCode(`invoice-${code}-${fy}`, `${code}/${fy}`, 4);
  // Only set when still empty (two clicks at once keep the first number)
  await BookingModel.updateOne({ _id: id, invoiceNo: { $exists: false } }, { invoiceNo, invoiceDate: new Date() });
  return getBooking(id, user);
}
