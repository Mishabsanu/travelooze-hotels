import "server-only";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { AppError } from "./http/errors";

/**
 * Aadhaar / ID proofs are stored in Cloudinary as PRIVATE ("authenticated") assets: a plain Cloudinary URL
 * does not work. They are only fetched server-side with a short-lived signed URL, inside
 * /api/bookings/:id/id-files/:index, which first checks the session, the guest_id permission and hotel access.
 *
 * Stored reference format (kept in booking.guest.idFiles): "<resourceType>|<publicId>|<ext>"
 *   image|travelooze-hotels/id-proofs/<bookingId>-<uuid>|jpg
 *   raw|travelooze-hotels/id-proofs/<bookingId>-<uuid>.pdf|pdf   (PDFs as raw: free plans block PDF delivery as image)
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const FOLDER = `${process.env.CLOUDINARY_FOLDER || "travelooze-hotels"}/id-proofs`;

const TYPES: Record<string, { ext: string; resource: "image" | "raw" }> = {
  "image/jpeg": { ext: "jpg", resource: "image" },
  "image/png": { ext: "png", resource: "image" },
  "image/webp": { ext: "webp", resource: "image" },
  "application/pdf": { ext: "pdf", resource: "raw" },
};
const CONTENT_TYPE: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
export const MAX_ID_FILE_BYTES = 4 * 1024 * 1024;

function assertConfigured() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new AppError("File storage is not configured (CLOUDINARY_* in .env.local)", 500);
  }
}

/** Uploads one ID proof privately to Cloudinary and returns the reference to store on the booking. */
export async function saveIdFile(bookingId: string, file: File): Promise<string> {
  const type = TYPES[file.type];
  if (!type) throw new AppError(`${file.name}: only JPG, PNG, WEBP or PDF allowed`, 422);
  if (file.size > MAX_ID_FILE_BYTES) throw new AppError(`${file.name}: max 4 MB`, 422);
  assertConfigured();

  const base = `${bookingId}-${randomUUID()}`;
  const publicId = type.resource === "raw" ? `${base}.${type.ext}` : base;
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: FOLDER, public_id: publicId, type: "authenticated", resource_type: type.resource, overwrite: false }, (err, res) =>
        err || !res ? reject(err ?? new Error("Upload failed")) : resolve(res)
      )
      .end(buffer);
  }).catch((e) => {
    console.error("[cloudinary] upload failed:", e);
    throw new AppError("Could not upload the file. Please try again.", 502);
  });
  return `${type.resource}|${result.public_id}|${type.ext}`;
}

function parseRef(ref: string) {
  const [resource, publicId, ext] = ref.split("|");
  if ((resource !== "image" && resource !== "raw") || !publicId?.startsWith(`${FOLDER}/`) || !CONTENT_TYPE[ext]) {
    throw new AppError("File not found", 404);
  }
  return { resource: resource as "image" | "raw", publicId, ext };
}

/** Fetches a private ID file from Cloudinary through a signed URL (never exposed to the browser). */
export async function readIdFile(ref: string): Promise<{ data: Buffer; type: string }> {
  assertConfigured();
  const { resource, publicId, ext } = parseRef(ref);
  // Signed, expiring API download link (works for images and raw PDFs, even where delivery ACLs block PDFs)
  const url = cloudinary.utils.private_download_url(publicId, resource === "image" ? ext : "", {
    resource_type: resource,
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 300,
  });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new AppError("File not found in storage", 404);
  return { data: Buffer.from(await res.arrayBuffer()), type: CONTENT_TYPE[ext] };
}
