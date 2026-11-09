import * as Yup from "yup";

export const PHONE_PATTERN = /^\+?[0-9\s\-()]{7,20}$/;

export const requiredText = (label: string, max = 120) =>
  Yup.string()
    .trim()
    .required(`${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

export const optionalText = (label: string, max = 500) =>
  Yup.string().trim().max(max, `${label} must be at most ${max} characters`).default("");

export const requiredPhone = (label: string) =>
  Yup.string()
    .trim()
    .required(`${label} is required`)
    .matches(PHONE_PATTERN, `${label} must be a valid phone number`);

export const optionalEmail = (label: string) =>
  Yup.string().trim().lowercase().email(`${label} must be a valid email`).default("");

export const requiredEmail = (label: string) =>
  Yup.string().trim().lowercase().required(`${label} is required`).email(`${label} must be a valid email`);

export const statusField = Yup.string()
  .oneOf(["active", "inactive"], "Status must be active or inactive")
  .default("active");

export const objectId = (label: string) =>
  Yup.string()
    .required(`${label} is required`)
    .matches(/^[a-f0-9]{24}$/i, `${label} is invalid`);

export type FieldErrors = Record<string, string>;

/** Flattens a Yup ValidationError into { field: firstMessage }. */
export function toFieldErrors(error: Yup.ValidationError): FieldErrors {
  const errors: FieldErrors = {};
  const list = error.inner.length ? error.inner : [error];
  for (const e of list) {
    const key = e.path || "_form";
    if (!errors[key]) errors[key] = e.message;
  }
  return errors;
}
