import type { AvailabilityType, Booking } from "@/lib/hotelTypes";
import { apiRequest, ApiError } from "./apiClient";

export const bookingApi = {
  create: (body: unknown) => apiRequest<Booking>("/api/bookings", "POST", body),
  update: (id: string, body: unknown) => apiRequest<Booking>(`/api/bookings/${id}`, "PUT", body),
  availability: (hotel: string, checkIn: string, checkOut: string) =>
    apiRequest<{ nights: number; types: AvailabilityType[] }>(
      `/api/bookings/availability?${new URLSearchParams({ hotel, checkIn, checkOut })}`
    ),
  checkIn: (id: string, at = "") => apiRequest<Booking>(`/api/bookings/${id}/check-in`, "POST", { at }),
  checkOut: (id: string, allowDue = false, at = "") => apiRequest<Booking>(`/api/bookings/${id}/check-out`, "POST", { allowDue, at }),
  cancel: (id: string, body: { reason: string; noShow: boolean }) => apiRequest<Booking>(`/api/bookings/${id}/cancel`, "POST", body),
  pay: (id: string, body: unknown) => apiRequest<Booking>(`/api/bookings/${id}/payments`, "POST", body),

  rooming: (id: string, body: unknown) => apiRequest<Booking>(`/api/bookings/${id}/rooming`, "PUT", body),

  /** multipart upload of one rooming-list guest's Aadhaar / ID files */
  async uploadGuestIds(id: string, guestId: string, files: File[], aadhaar = ""): Promise<Booking> {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    form.append("aadhaar", aadhaar);
    let res: Response;
    try {
      res = await fetch(`/api/bookings/${id}/guests/${guestId}/id-files`, { method: "POST", body: form, credentials: "same-origin" });
    } catch {
      throw new ApiError("Network error. Check your connection and try again.", 0);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || "Upload failed", res.status, data.fieldErrors);
    return data as Booking;
  },

  /** multipart upload of Aadhaar / ID files (JSON apiRequest cannot carry files) */
  async uploadIds(id: string, files: File[], aadhaar = ""): Promise<Booking> {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    form.append("aadhaar", aadhaar);
    let res: Response;
    try {
      res = await fetch(`/api/bookings/${id}/id-files`, { method: "POST", body: form, credentials: "same-origin" });
    } catch {
      throw new ApiError("Network error. Check your connection and try again.", 0);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || "Upload failed", res.status, data.fieldErrors);
    return data as Booking;
  },
};

export const ID_FILE_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
export const MAX_ID_FILE_MB = 4;

/** Client-side check before uploading (the server checks again). */
export function idFileProblem(files: File[]): string | null {
  for (const f of files) {
    if (!ID_FILE_ACCEPT.split(",").includes(f.type)) return `${f.name}: only JPG, PNG, WEBP or PDF`;
    if (f.size > MAX_ID_FILE_MB * 1024 * 1024) return `${f.name}: max ${MAX_ID_FILE_MB} MB`;
  }
  return null;
}
