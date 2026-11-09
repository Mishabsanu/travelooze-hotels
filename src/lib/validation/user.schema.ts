import * as Yup from "yup";
import { objectId, requiredEmail, requiredPhone, requiredText, statusField } from "./common";

export const MIN_PASSWORD_LENGTH = 8;

const passwordRule = Yup.string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(72, "Password must be at most 72 characters")
  .matches(/[A-Za-z]/, "Password must contain a letter")
  .matches(/[0-9]/, "Password must contain a number");

const baseUserFields = {
  name: requiredText("Full name", 100),
  email: requiredEmail("Email"),
  mobile: requiredPhone("Mobile"),
  role: objectId("Role"),
  status: statusField,
  /** Works at every hotel (owners, sales, accounts) */
  allHotels: Yup.boolean().default(false),
  /** Hotels a manager / receptionist works at */
  hotels: Yup.array()
    .of(Yup.string().required().matches(/^[a-f0-9]{24}$/i, "Invalid hotel"))
    .default([])
    .test("hotel-required", "Assign at least one hotel, or tick All hotels", function (value) {
      return Boolean(this.parent.allHotels) || (value?.length ?? 0) > 0;
    }),
};

/** Creating a user: password is mandatory. */
export const createUserSchema = Yup.object({
  ...baseUserFields,
  password: passwordRule.required("Password is required"),
  confirmPassword: Yup.string()
    .required("Please confirm the password")
    .oneOf([Yup.ref("password")], "Passwords do not match"),
});

/** Editing a user: password only changes when one is typed. */
export const updateUserSchema = Yup.object({
  ...baseUserFields,
  password: Yup.string()
    .default("")
    .test("password-rules", "", function (value) {
      if (!value) return true;
      try {
        passwordRule.validateSync(value);
        return true;
      } catch (e) {
        return this.createError({ message: (e as Yup.ValidationError).message });
      }
    }),
  confirmPassword: Yup.string()
    .default("")
    .test("password-match", "Passwords do not match", function (value) {
      return !this.parent.password || value === this.parent.password;
    }),
});

export type UserInput = Yup.InferType<typeof createUserSchema>;

export const emptyUser: UserInput = {
  name: "",
  email: "",
  mobile: "",
  role: "",
  status: "active",
  allHotels: false,
  hotels: [],
  password: "",
  confirmPassword: "",
};

export const loginSchema = Yup.object({
  email: Yup.string().trim().required("Email or mobile is required"),
  password: Yup.string().required("Password is required"),
});
