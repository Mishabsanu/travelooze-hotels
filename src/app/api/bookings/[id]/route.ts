import * as Yup from "yup";
import { optionalTime } from "@/lib/validation/booking.schema";
import { optionalText, requiredPhone, requiredText } from "@/lib/validation/common";
import { apiHandler, readBody } from "@/server/http/handler";
import { getBooking } from "@/server/services/booking/booking.service";
import { updateGuest } from "@/server/services/booking/bookingActions";

const guestSchema = Yup.object({
  guestName: requiredText("Guest name", 100),
  phone: requiredPhone("Phone"),
  address: optionalText("Address", 300),
  adults: Yup.number().integer().min(1).required(),
  children: Yup.number().integer().min(0).default(0),
  agentRef: optionalText("Agent reference", 60),
  notes: optionalText("Notes", 1000),
  arrivalTime: optionalTime("Arrival time"),
  departureTime: optionalTime("Departure time"),
});

export const GET = apiHandler<{ id: string }>("authenticated", async ({ params, user }) => getBooking(params.id, user));

export const PUT = apiHandler<{ id: string }>("authenticated", async ({ req, params, user }) =>
  updateGuest(params.id, await readBody(req, guestSchema), user)
);
