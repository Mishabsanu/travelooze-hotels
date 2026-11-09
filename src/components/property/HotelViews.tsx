"use client";

import { Form, Formik } from "formik";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import { HOTEL_CATEGORIES, toOptions } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { timeLabel } from "@/lib/stayTimes";
import type { Hotel } from "@/lib/hotelTypes";
import type { Paginated } from "@/lib/types";
import { emptyHotel, hotelSchema, type HotelInput } from "@/lib/validation/hotel.schema";
import { resourceApi } from "@/services/apiClient";
import { HOTEL_UI } from "./propertyConfig";

const CATEGORY_OPTIONS = toOptions(HOTEL_CATEGORIES);
const api = resourceApi<Hotel>(HOTEL_UI.apiBase);

export function HotelListView({ data }: { data: Paginated<Hotel> }) {
  const canEdit = usePermission("hotel", "update");
  const canDelete = usePermission("hotel", "delete");
  const canRooms = usePermission("room", "view");

  const columns = useMemo<Column<Hotel>[]>(
    () => [
      { key: "code", label: "Code", mono: true, width: "90px" },
      { key: "name", label: "Hotel", render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
      { key: "category", label: "Category", render: (r) => <Badge variant="brand">{HOTEL_CATEGORIES[r.category]}</Badge> },
      {
        key: "roomCount",
        label: "Rooms",
        align: "center",
        sortKey: false,
        render: (r) =>
          canRooms ? (
            <Link href={`/dashboard/property/rooms?hotel=${r._id}`} className="text-brand font-semibold hover:underline">
              {r.roomCount ?? 0}
            </Link>
          ) : (
            r.roomCount ?? 0
          ),
      },
      { key: "phone", label: "Phone" },
      {
        key: "checkInTime",
        label: "Check-in / out",
        render: (r) => `${timeLabel(r.checkInTime || "12:00")} / ${timeLabel(r.checkOutTime || "11:00")}`,
      },
      { key: "gstin", label: "GSTIN", mono: true, hiddenByDefault: true },
      { key: "address", label: "Address", hiddenByDefault: true },
      { key: "status", label: "Status", align: "center", render: (r) => <StatusBadge status={r.status} /> },
      { key: "createdAt", label: "Created", render: (r) => formatDate(r.createdAt) },
    ],
    [canRooms]
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="hotels"
      searchPlaceholder="Search hotels by name, code, phone or address..."
      filters={[STATUS_FILTER, { key: "category", allLabel: "All Categories", options: CATEGORY_OPTIONS }]}
      rowActions={(row) => (
        <RowActions
          entityLabel={HOTEL_UI.label}
          itemName={row.name}
          viewHref={`${HOTEL_UI.basePath}/${row._id}`}
          editHref={canEdit ? `${HOTEL_UI.basePath}/${row._id}/edit` : undefined}
          deleteUrl={canDelete ? `${HOTEL_UI.apiBase}/${row._id}` : undefined}
        />
      )}
    />
  );
}

export function HotelForm({ initial }: { initial?: Hotel }) {
  const initialValues: HotelInput = initial
    ? {
        code: initial.code,
        name: initial.name,
        category: initial.category,
        address: initial.address,
        phone: initial.phone,
        email: initial.email,
        gstin: initial.gstin,
        checkInTime: initial.checkInTime || "12:00",
        checkOutTime: initial.checkOutTime || "11:00",
        status: initial.status,
      }
    : emptyHotel;

  const onSubmit = useApiSubmit<HotelInput, Hotel>({
    request: (values) => (initial ? api.update(initial._id, values) : api.create(values)),
    successMessage: initial ? "Hotel updated" : "Hotel created",
    redirectTo: HOTEL_UI.basePath,
  });

  return (
    <Formik initialValues={initialValues} validationSchema={hotelSchema} onSubmit={onSubmit}>
      {({ isSubmitting }) => (
        <Form noValidate>
          <FormCard
            title={initial ? "Edit Hotel" : "Add Hotel"}
            description={HOTEL_UI.description}
            badge={initial ? initial.code : "New Record"}
            icon={<Building2 className="w-4.5 h-4.5" />}
            backHref={HOTEL_UI.basePath}
            submitLabel="Save Hotel"
            submitting={isSubmitting}
          >
            <FormSection title="Hotel Details">
              <TextField name="name" label="Hotel Name" required placeholder="e.g. Grand Residency" maxLength={120} />
              <TextField name="code" label="Code" required placeholder="GRD" maxLength={6} hint="Used in booking numbers" />
              <SelectField name="category" label="Category" required options={CATEGORY_OPTIONS} />
              <TextField name="phone" label="Phone" placeholder="0484 XXXXXXX" />
              <TextField name="email" label="Email" type="email" placeholder="frontdesk@hotel.com" />
              <TextField name="gstin" label="GSTIN" placeholder="32ABCDE1234F1Z5" maxLength={15} />
              <SelectField name="status" label="Status" required options={STATUS_OPTIONS} />
            </FormSection>
            <FormSection title="Standard Times" description="Used for expected arrival / departure and to flag early check-ins and late check-outs (India time).">
              <TextField name="checkInTime" label="Check-in Time" type="time" required />
              <TextField name="checkOutTime" label="Check-out Time" type="time" required />
            </FormSection>
            <FormSection title="Address">
              <TextAreaField name="address" label="Address" className="md:col-span-2" maxLength={300} />
            </FormSection>
          </FormCard>
        </Form>
      )}
    </Formik>
  );
}
