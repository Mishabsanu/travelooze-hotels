"use client";

import { Form, Formik } from "formik";
import { ShieldCheck } from "lucide-react";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import type { Role } from "@/lib/types";
import { emptyRole, roleSchema, type RoleInput } from "@/lib/validation/role.schema";
import { resourceApi } from "@/services/apiClient";
import { GlobalAccessToggle } from "./GlobalAccessToggle";
import { PermissionMatrix } from "./PermissionMatrix";
import { toGrid } from "./permissionUtils";
import { ROLE_UI, SUPER_ADMIN_NOTE } from "./roleConfig";

const api = resourceApi<Role>(ROLE_UI.apiBase);

export function RoleForm({ initial }: { initial?: Role }) {
  const isEdit = Boolean(initial);

  const initialValues: RoleInput = initial
    ? {
        name: initial.name,
        description: initial.description || "",
        status: initial.status,
        isSuperAdmin: initial.isSuperAdmin,
        permissions: toGrid(initial.permissions),
      }
    : emptyRole();

  const onSubmit = useApiSubmit<RoleInput, Role>({
    request: (values) => (initial ? api.update(initial._id, values) : api.create(values)),
    successMessage: isEdit ? "Role updated" : "Role created",
    redirectTo: ROLE_UI.basePath,
  });

  return (
    <Formik initialValues={initialValues} validationSchema={roleSchema} onSubmit={onSubmit}>
      {({ isSubmitting, values, errors, touched, submitCount, setFieldValue, setFieldTouched }) => {
        const isSuperAdmin = Boolean(values.isSuperAdmin);
        const permissionError =
          (touched.permissions || submitCount > 0) && typeof errors.permissions === "string"
            ? errors.permissions
            : undefined;
        return (
          <Form noValidate>
            <FormCard
              title={isEdit ? "Edit Role" : "Create New Role"}
              description={ROLE_UI.description}
              badge={initial?.isSuperAdmin ? "SUPER ADMIN" : isEdit ? undefined : "New Record"}
              icon={<ShieldCheck className="w-4.5 h-4.5" />}
              backHref={ROLE_UI.basePath}
              submitLabel="Save Role"
              submitting={isSubmitting}
            >
              <FormSection title="Role Details">
                <TextField name="name" label="Role Name" required placeholder="e.g. Store Keeper" maxLength={60} />
                <SelectField
                  name="status"
                  label="Status"
                  required
                  options={STATUS_OPTIONS}
                  disabled={isSuperAdmin}
                  hint={isSuperAdmin ? "Super Admin is always active" : undefined}
                />
                <TextAreaField
                  name="description"
                  label="Description"
                  className="md:col-span-2 lg:col-span-3"
                  placeholder="What this role is for"
                  maxLength={300}
                />
                <GlobalAccessToggle />
              </FormSection>

              <FormSection
                title="Permissions"
                description="Ticking Create, Update or Delete also grants View. Removing View clears the row."
              >
                <div className="md:col-span-2 lg:col-span-3">
                  <PermissionMatrix
                    value={values.permissions}
                    disabled={isSuperAdmin}
                    note={isSuperAdmin ? SUPER_ADMIN_NOTE : undefined}
                    error={permissionError}
                    onChange={(next) => {
                      setFieldValue("permissions", next);
                      setFieldTouched("permissions", true, false);
                    }}
                  />
                </div>
              </FormSection>
            </FormCard>
          </Form>
        );
      }}
    </Formik>
  );
}
