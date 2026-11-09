"use client";

import { Form, Formik } from "formik";
import { UserRound } from "lucide-react";
import { useState } from "react";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { SelectField, STATUS_OPTIONS, TextField } from "@/components/forms/FormikFields";
import { useSession } from "@/components/providers/SessionProvider";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import type { Option } from "@/lib/types";
import { createUserSchema, emptyUser, MIN_PASSWORD_LENGTH, updateUserSchema, type UserInput } from "@/lib/validation/user.schema";
import type { UserRecord } from "@/server/services/user.service";
import { resourceApi } from "@/services/apiClient";
import { HotelAssignField } from "./HotelAssignField";
import { PasswordField } from "./PasswordField";
import { USER_UI } from "./userConfig";

const api = resourceApi<UserRecord>(USER_UI.apiBase);

interface UserFormProps {
  initial?: UserRecord;
  roleOptions: Option[];
  hotelOptions: Option[];
  /** Role ids with Global Access (they always work at every hotel) */
  superAdminRoleIds: string[];
}

export function UserForm({ initial, roleOptions, hotelOptions, superAdminRoleIds }: UserFormProps) {
  const session = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const isEdit = Boolean(initial);
  const isSelf = initial?._id === session._id;

  const initialValues: UserInput = initial
    ? {
        name: initial.name,
        email: initial.email,
        mobile: initial.mobile,
        role: initial.role?._id ?? "",
        status: initial.status,
        allHotels: initial.allHotels,
        hotels: (initial.hotels ?? []).map((h) => h._id),
        password: "",
        confirmPassword: "",
      }
    : emptyUser;

  const onSubmit = useApiSubmit<UserInput, UserRecord>({
    request: (values) => (initial ? api.update(initial._id, values) : api.create(values)),
    successMessage: isEdit ? "User updated" : "User created",
    redirectTo: USER_UI.basePath,
  });

  const toggle = () => setShowPassword((v) => !v);

  return (
    <Formik initialValues={initialValues} validationSchema={isEdit ? updateUserSchema : createUserSchema} onSubmit={onSubmit}>
      {({ isSubmitting, values }) => (
        <Form noValidate>
          <FormCard
            title={isEdit ? "Edit User" : "Create New User"}
            description={USER_UI.description}
            badge={isEdit ? initial?.email : "New Record"}
            icon={<UserRound className="w-4.5 h-4.5" />}
            backHref={USER_UI.basePath}
            submitLabel="Save User"
            submitting={isSubmitting}
          >
            <FormSection title="Account">
              <TextField name="name" label="Full Name" required placeholder="e.g. Riya Menon" maxLength={100} />
              <TextField name="email" label="Email" type="email" required placeholder="name@company.com" autoComplete="off" />
              <TextField name="mobile" label="Mobile" required placeholder="98XXXXXXXX" />
              <SelectField
                name="role"
                label="Role"
                required
                placeholder="Select a role"
                options={roleOptions}
                disabled={isSelf}
                hint={isSelf ? "You cannot change your own role" : undefined}
              />
              <SelectField
                name="status"
                label="Status"
                required
                options={STATUS_OPTIONS}
                disabled={isSelf}
                hint={isSelf ? "You cannot deactivate yourself" : undefined}
              />
              {isEdit && (
                <div className="space-y-1.5">
                  <span className="block text-[12px] font-semibold text-slate-700">Created By</span>
                  <p className="h-9 flex items-center px-3 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg">
                    {initial?.createdBy?.name || "—"}
                  </p>
                </div>
              )}
            </FormSection>

            <FormSection
              title="Hotels"
              description="Managers and receptionists only see bookings, rooms and reports of the hotels ticked here."
            >
              <HotelAssignField options={hotelOptions} superAdminRole={superAdminRoleIds.includes(values.role)} />
            </FormSection>

            <FormSection
              title="Password"
              description={
                isEdit
                  ? "Leave blank to keep current password"
                  : `At least ${MIN_PASSWORD_LENGTH} characters, with a letter and a number`
              }
            >
              <PasswordField
                name="password"
                label={isEdit ? "New Password" : "Password"}
                required={!isEdit}
                hint={isEdit ? "Leave blank to keep current password" : undefined}
                autoComplete="new-password"
                visible={showPassword}
                onToggle={toggle}
              />
              <PasswordField
                name="confirmPassword"
                label="Confirm Password"
                required={!isEdit}
                autoComplete="new-password"
                visible={showPassword}
                onToggle={toggle}
              />
            </FormSection>
          </FormCard>
        </Form>
      )}
    </Formik>
  );
}
