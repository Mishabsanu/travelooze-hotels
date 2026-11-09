import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "./http/errors";

/**
 * Aadhaar / ID proofs live on the server disk OUTSIDE /public, so they can only be downloaded through
 * /api/bookings/:id/id-files/:name, which checks the session, the guest_id permission and hotel access.
 * For cloud hosting, replace these functions with private S3 / Cloudinary storage.
 */
const ROOT = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "./storage", "id-proofs");

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const MAX_ID_FILE_BYTES = 4 * 1024 * 1024;

export async function saveIdFile(bookingId: string, file: File): Promise<string> {
  if (!ALLOWED[file.type]) throw new AppError(`${file.name}: only JPG, PNG, WEBP or PDF allowed`, 422);
  if (file.size > MAX_ID_FILE_BYTES) throw new AppError(`${file.name}: max 4 MB`, 422);
  await mkdir(ROOT, { recursive: true });
  const name = `${bookingId}-${randomUUID()}.${ALLOWED[file.type]}`;
  await writeFile(path.join(ROOT, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function readIdFile(name: string) {
  if (!/^[a-f0-9]{24}-[a-f0-9-]{36}\.(jpg|png|webp|pdf)$/.test(name)) throw new AppError("File not found", 404);
  const ext = name.split(".").pop()!;
  const type = Object.entries(ALLOWED).find(([, e]) => e === ext)![0];
  try {
    return { data: await readFile(path.join(ROOT, name)), type };
  } catch {
    throw new AppError("File not found", 404);
  }
}
