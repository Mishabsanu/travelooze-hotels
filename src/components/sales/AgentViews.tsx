"use client";

import { Form, Formik } from "formik";
import { Handshake } from "lucide-react";
import { useMemo } from "react";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import { formatINR } from "@/lib/format";
import type { Agent } from "@/lib/hotelTypes";
import type { Paginated } from "@/lib/types";
import { agentSchema, emptyAgent, type AgentInput } from "@/lib/validation/agent.schema";
import { resourceApi } from "@/services/apiClient";

import { AGENT_UI } from "./agentConfig";

const api = resourceApi<Agent>(AGENT_UI.apiBase);

export function AgentListView({ data }: { data: Paginated<Agent> }) {
  const canEdit = usePermission("agent", "update");
  const canDelete = usePermission("agent", "delete");

  const columns = useMemo<Column<Agent>[]>(
    () => [
      { key: "code", label: "Code", mono: true, width: "100px" },
      { key: "name", label: "Agent", render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
      {
        key: "contactPerson",
        label: "Contact",
        render: (r) => (
          <span className="flex flex-col">
            <span>{r.contactPerson || "—"}</span>
            <span className="text-[10.5px] text-slate-400">{r.phone}</span>
          </span>
        ),
      },
      { key: "email", label: "Email", hiddenByDefault: true },
      { key: "discountPercent", label: "Discount", align: "center", render: (r) => <Badge variant="brand">{r.discountPercent}%</Badge> },
      {
        key: "outstanding",
        label: "Outstanding",
        align: "right",
        sortKey: false,
        render: (r) => {
          return <span className={`tabular-nums font-semibold ${(r.outstanding ?? 0) > 0 ? "text-amber-700" : "text-slate-400"}`}>{formatINR(r.outstanding)}</span>;
        },
      },
      { key: "bookingCount", label: "Bookings", align: "center", sortKey: false },
      { key: "status", label: "Status", align: "center", render: (r) => <StatusBadge status={r.status} /> },
    ],
    []
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="agents"
      searchPlaceholder="Search agents by name, code, contact, phone or email..."
      filters={[STATUS_FILTER]}
      rowActions={(row) => (
        <RowActions
          entityLabel={AGENT_UI.label}
          itemName={row.name}
          viewHref={`${AGENT_UI.basePath}/${row._id}`}
          editHref={canEdit ? `${AGENT_UI.basePath}/${row._id}/edit` : undefined}
          deleteUrl={canDelete ? `${AGENT_UI.apiBase}/${row._id}` : undefined}
        />
      )}
    />
  );
}

export function AgentForm({ initial }: { initial?: Agent }) {
  const initialValues: AgentInput = initial
    ? {
        name: initial.name,
        contactPerson: initial.contactPerson,
        phone: initial.phone,
        email: initial.email,
        address: initial.address,
        gstin: initial.gstin,
        discountPercent: initial.discountPercent,
        creditLimit: initial.creditLimit ?? 0,
        status: initial.status,
      }
    : emptyAgent;

  const onSubmit = useApiSubmit<AgentInput, Agent>({
    request: (values) => (initial ? api.update(initial._id, values) : api.create(values)),
    successMessage: initial ? "Agent updated" : "Agent created",
    redirectTo: AGENT_UI.basePath,
  });

  return (
    <Formik initialValues={initialValues} validationSchema={agentSchema} onSubmit={onSubmit}>
      {({ isSubmitting }) => (
        <Form noValidate>
          <FormCard
            title={initial ? "Edit Agent" : "Add Agent"}
            description={AGENT_UI.description}
            badge={initial ? initial.code : "New Record"}
            icon={<Handshake className="w-4.5 h-4.5" />}
            backHref={AGENT_UI.basePath}
            submitLabel="Save Agent"
            submitting={isSubmitting}
          >
            <FormSection title="Agency">
              <TextField name="name" label="Agency / Company Name" required placeholder="e.g. Sunrise Travels" maxLength={120} />
              <TextField name="contactPerson" label="Contact Person" maxLength={100} />
              <TextField name="phone" label="Phone" required placeholder="98XXXXXXXX" />
              <TextField name="email" label="Email" type="email" />
              <TextField name="gstin" label="GSTIN" maxLength={15} />
              <SelectField name="status" label="Status" required options={STATUS_OPTIONS} />
              <TextAreaField name="address" label="Address" className="md:col-span-2" maxLength={300} />
            </FormSection>
            <FormSection title="Contract" description="The discount is applied automatically on every booking for this agent.">
              <TextField name="discountPercent" label="Contract Discount %" type="number" min={0} max={100} step="0.5" required />
            </FormSection>
          </FormCard>
        </Form>
      )}
    </Formik>
  );
}
