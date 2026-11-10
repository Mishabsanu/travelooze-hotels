import * as Yup from "yup";
import { optionalEmail, optionalText, requiredPhone, requiredText, statusField } from "./common";

export const agentSchema = Yup.object({
  name: requiredText("Agency / company name", 120),
  contactPerson: optionalText("Contact person", 100),
  phone: requiredPhone("Phone"),
  email: optionalEmail("Email"),
  address: optionalText("Address", 300),
  gstin: Yup.string().trim().uppercase().default("").max(15, "GSTIN is 15 characters"),
  discountPercent: Yup.number().typeError("Enter a number").min(0).max(100, "At most 100%").required(),
  creditLimit: Yup.number().typeError("Enter a number").min(0).default(0),
  status: statusField,
});
export type AgentInput = Yup.InferType<typeof agentSchema>;
export const emptyAgent: AgentInput = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  gstin: "",
  discountPercent: 0,
  creditLimit: 0,
  status: "active",
};
