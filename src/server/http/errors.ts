import "server-only";
import { NextResponse } from "next/server";
import { ValidationError } from "yup";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/common";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public fieldErrors?: FieldErrors
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(`${what} not found`, 404);

const DUPLICATE_LABELS: Record<string, string> = {
  email: "This email is already in use",
  itemCode: "This item code already exists",
  nameKey: "A role with this name already exists",
  code: "This code already exists",
  sku: "This SKU already exists",
  number: "This room number already exists in the hotel",
  bookingNo: "Booking number clash, please try again",
};

/** Maps any thrown error to a JSON response with a safe message. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
  }
  if (error instanceof ValidationError) {
    const fieldErrors = toFieldErrors(error);
    return NextResponse.json(
      { error: Object.values(fieldErrors)[0] || "Please correct the highlighted fields", fieldErrors },
      { status: 422 }
    );
  }
  const err = error as { code?: number; keyPattern?: Record<string, unknown>; name?: string };
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "value";
    const message = DUPLICATE_LABELS[field] || `Duplicate ${field}`;
    const key = field === "nameKey" ? "name" : field;
    return NextResponse.json({ error: message, fieldErrors: { [key]: message } }, { status: 409 });
  }
  if (err?.name === "CastError") {
    return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Request body is not valid JSON" }, { status: 400 });
  }
  console.error("[api] Unhandled error:", error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
