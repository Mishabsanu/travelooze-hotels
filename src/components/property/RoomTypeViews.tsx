"use client";

import { Form, Formik } from "formik";
import { BedDouble } from "lucide-react";
import { useMemo } from "react";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { SelectField, STATUS_OPTIONS, TextField } from "@/components/forms/FormikFields";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import { MEAL_PLANS, MEAL_PLAN_CODES } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import type { RoomType } from "@/lib/hotelTypes";
import type { Option, Paginated } from "@/lib/types";
import { emptyRoomType, roomTypeSchema, type RoomTypeInput } from "@/lib/validation/hotel.schema";
import { resourceApi } from "@/services/apiClient";
import { ROOM_TYPE_UI } from "./propertyConfig";
import { SeasonEditor } from "./SeasonEditor";

const api = resourceApi<RoomType>(ROOM_TYPE_UI.apiBase);

export function RoomTypeListView({ data, hotelOptions }: { data: Paginated<RoomType>; hotelOptions: Option[] }) {
  const canEdit = usePermission("room_type", "update");
  const canDelete = usePermission("room_type", "delete");

  const columns = useMemo<Column<RoomType>[]>(
    () => [
      { key: "hotel", label: "Hotel", sortKey: false, render: (r) => r.hotel?.name ?? "—" },
      { key: "name", label: "Room Type", render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
      {
        key: "maxAdults",
        label: "Capacity",
        align: "center",
        render: (r) => `${r.maxAdults}A + ${r.maxChildren ?? 2}C + ${r.maxExtraBeds ?? 1} EB`,
      },
      {
        key: "extraBedRates",
        label: "Extra Bed (EP)",
        align: "right",
        sortKey: false,
        render: (r) => <span className="tabular-nums">{formatINR(r.extraBedRates?.EP ?? 0)}</span>,
      },
      ...MEAL_PLAN_CODES.map<Column<RoomType>>((c) => ({
        key: `rates.${c}`,
        label: `${c} Rate`,
        align: "right",
        render: (r) => <span className="tabular-nums">{formatINR(r.rates?.[c])}</span>,
      })),
      {
        key: "seasons",
        label: "Seasons",
        align: "center",
        sortKey: false,
        render: (r) =>
          r.seasons?.length ? (
            <span title={r.seasons.map((s) => `${s.name}: ${s.from} → ${s.to}${s.yearly ? " (every year)" : ""}`).join("\n")}>
              <Badge variant="warning">{r.seasons.length} season{r.seasons.length > 1 ? "s" : ""}</Badge>
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          ),
      },
      { key: "roomCount", label: "Rooms", align: "center", sortKey: false, render: (r) => r.roomCount ?? 0 },
      { key: "status", label: "Status", align: "center", render: (r) => <StatusBadge status={r.status} /> },
    ],
    []
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="room types"
      searchPlaceholder="Search room types..."
      filters={[{ key: "hotel", allLabel: "All Hotels", options: hotelOptions, minWidth: "180px" }, STATUS_FILTER]}
      rowActions={(row) => (
        <RowActions
          entityLabel={ROOM_TYPE_UI.label}
          itemName={`${row.name} – ${row.hotel?.name ?? ""}`}
          editHref={canEdit ? `${ROOM_TYPE_UI.basePath}/${row._id}/edit` : undefined}
          deleteUrl={canDelete ? `${ROOM_TYPE_UI.apiBase}/${row._id}` : undefined}
        />
      )}
    />
  );
}

export function RoomTypeForm({ initial, hotelOptions, defaultHotel }: { initial?: RoomType; hotelOptions: Option[]; defaultHotel?: string }) {
  const initialValues: RoomTypeInput = initial
    ? {
        hotel: initial.hotel?._id ?? "",
        name: initial.name,
        maxAdults: initial.maxAdults,
        maxChildren: initial.maxChildren ?? 2,
        maxExtraBeds: initial.maxExtraBeds ?? 1,
        rates: { ...emptyRoomType.rates, ...initial.rates },
        extraBedRates: { ...emptyRoomType.extraBedRates, ...(initial.extraBedRates ?? {}) },
        seasons: (initial.seasons ?? []).map((s) => ({
          _id: s._id ?? "",
          name: s.name,
          from: s.from,
          to: s.to,
          yearly: Boolean(s.yearly),
          rates: { ...emptyRoomType.rates, ...s.rates },
          extraBedRates: { ...emptyRoomType.extraBedRates, ...(s.extraBedRates ?? {}) },
        })),
        status: initial.status,
      }
    : { ...emptyRoomType, hotel: defaultHotel ?? (hotelOptions.length === 1 ? hotelOptions[0].value : "") };

  const onSubmit = useApiSubmit<RoomTypeInput, RoomType>({
    request: (values) => (initial ? api.update(initial._id, values) : api.create(values)),
    successMessage: initial ? "Room type updated" : "Room type created",
    redirectTo: ROOM_TYPE_UI.basePath,
  });

  return (
    <Formik initialValues={initialValues} validationSchema={roomTypeSchema} onSubmit={onSubmit}>
      {({ isSubmitting }) => (
        <Form noValidate>
          <FormCard
            title={initial ? "Edit Room Type" : "Add Room Type"}
            description={ROOM_TYPE_UI.description}
            badge={initial ? initial.hotel?.name : "New Record"}
            icon={<BedDouble className="w-4.5 h-4.5" />}
            backHref={ROOM_TYPE_UI.basePath}
            submitLabel="Save Room Type"
            submitting={isSubmitting}
          >
            <FormSection title="Room Type">
              <SelectField
                name="hotel"
                label="Hotel"
                required
                placeholder="Select hotel"
                options={hotelOptions}
                disabled={Boolean(initial)}
                hint={initial ? "Cannot be changed" : undefined}
              />
              <TextField name="name" label="Room Type" required placeholder="e.g. Deluxe" maxLength={60} />
              <TextField name="maxAdults" label="Max Adults" type="number" min={1} max={10} required hint="Without extra beds" />
              <TextField name="maxChildren" label="Max Children" type="number" min={0} max={10} />
              <TextField name="maxExtraBeds" label="Max Extra Beds" type="number" min={0} max={5} hint="Each adds 1 adult" />
              <SelectField name="status" label="Status" required options={STATUS_OPTIONS} />
            </FormSection>
            <FormSection title="Normal Rates per room per night (before GST)" description="Used on every night that is not in a season. GST is added automatically on the booking by slab.">
              {MEAL_PLAN_CODES.map((c) => (
                <TextField key={c} name={`rates.${c}`} label={MEAL_PLANS[c].label} type="number" min={0} step="1" required />
              ))}
            </FormSection>
            <FormSection
              title="Extra bed rate per bed per night (before GST)"
              description="Charged for each extra bed on a booking. For MAP / AP include the meals of the extra person."
            >
              {MEAL_PLAN_CODES.map((c) => (
                <TextField key={c} name={`extraBedRates.${c}`} label={`Extra Bed – ${c}`} type="number" min={0} step="1" />
              ))}
            </FormSection>
            <FormSection
              title="Seasonal Rates"
              description="Peak, festival or off-season prices between two dates. Nights inside a season use its rate; a blank rate uses the normal one. A stay across seasons is priced night by night."
            >
              <SeasonEditor />
            </FormSection>
          </FormCard>
        </Form>
      )}
    </Formik>
  );
}
