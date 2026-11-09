"use client";

import { Form, Formik, useFormikContext } from "formik";
import { DoorOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { SelectField, STATUS_OPTIONS, TextField } from "@/components/forms/FormikFields";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import { ROOM_STATUS, toOptions, type RoomStatus } from "@/lib/constants";
import type { Room } from "@/lib/hotelTypes";
import type { Option, Paginated } from "@/lib/types";
import { emptyRoomCreate, roomCreateSchema, roomUpdateSchema, type RoomCreateInput, type RoomUpdateInput } from "@/lib/validation/hotel.schema";
import { apiRequest, ApiError } from "@/services/apiClient";
import { ROOM_UI } from "./propertyConfig";

const HK_OPTIONS = toOptions(ROOM_STATUS);
const HK_COLORS: Record<RoomStatus, string> = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cleaning: "bg-amber-50 text-amber-800 border-amber-200",
  maintenance: "bg-rose-50 text-rose-700 border-rose-200",
};

type TypeOption = Option & { hotel: string };

/** Inline housekeeping switch (clean / cleaning / maintenance) for one room. */
function HousekeepingSelect({ room, editable }: { room: Room; editable: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(room.housekeeping);
  const [busy, setBusy] = useState(false);
  const change = async (next: RoomStatus) => {
    setBusy(true);
    try {
      await apiRequest(`${ROOM_UI.apiBase}/${room._id}`, "PATCH", { housekeeping: next });
      setValue(next);
      toast.success(`Room ${room.number}: ${ROOM_STATUS[next]}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  };
  return (
    <select
      value={value}
      disabled={!editable || busy}
      onChange={(e) => change(e.target.value as RoomStatus)}
      aria-label={`Housekeeping for room ${room.number}`}
      className={`h-6 px-1.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${HK_COLORS[value]} disabled:opacity-70`}
    >
      {HK_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function RoomListView({ data, hotelOptions, typeOptions }: { data: Paginated<Room>; hotelOptions: Option[]; typeOptions: TypeOption[] }) {
  const canEdit = usePermission("room", "update");
  const canDelete = usePermission("room", "delete");

  const columns = useMemo<Column<Room>[]>(
    () => [
      { key: "number", label: "Room", mono: true, render: (r) => <span className="font-bold text-slate-900">{r.number}</span> },
      { key: "hotel", label: "Hotel", sortKey: false, render: (r) => r.hotel?.name ?? "—" },
      { key: "roomType", label: "Room Type", sortKey: false, render: (r) => r.roomType?.name ?? "—" },
      { key: "floor", label: "Floor", align: "center" },
      { key: "housekeeping", label: "Housekeeping", align: "center", render: (r) => <HousekeepingSelect room={r} editable={canEdit} /> },
      { key: "status", label: "Status", align: "center", render: (r) => <StatusBadge status={r.status} /> },
    ],
    [canEdit]
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="rooms"
      searchPlaceholder="Search by room number or floor..."
      filters={[
        { key: "hotel", allLabel: "All Hotels", options: hotelOptions, minWidth: "180px" },
        { key: "roomType", allLabel: "All Room Types", options: typeOptions, minWidth: "170px" },
        { key: "housekeeping", allLabel: "Any Housekeeping", options: HK_OPTIONS },
        STATUS_FILTER,
      ]}
      rowActions={(row) => (
        <RowActions
          entityLabel={ROOM_UI.label}
          itemName={`Room ${row.number} – ${row.hotel?.name ?? ""}`}
          editHref={canEdit ? `${ROOM_UI.basePath}/${row._id}/edit` : undefined}
          deleteUrl={canDelete ? `${ROOM_UI.apiBase}/${row._id}` : undefined}
        />
      )}
    />
  );
}

/** Room type dropdown that only lists the types of the chosen hotel. */
function TypeSelect({ typeOptions }: { typeOptions: TypeOption[] }) {
  const { values, setFieldValue } = useFormikContext<RoomCreateInput>();
  const options = typeOptions.filter((t) => t.hotel === values.hotel);
  return (
    <SelectField
      name="roomType"
      label="Room Type"
      required
      placeholder={values.hotel ? (options.length ? "Select room type" : "No room types in this hotel") : "Select a hotel first"}
      options={options}
      onChange={(e) => setFieldValue("roomType", e.target.value)}
    />
  );
}

export function RoomCreateForm({ hotelOptions, typeOptions, defaultHotel }: { hotelOptions: Option[]; typeOptions: TypeOption[]; defaultHotel?: string }) {
  const onSubmit = useApiSubmit<RoomCreateInput, { created: number; skipped: string[] }>({
    request: (values) => apiRequest(ROOM_UI.apiBase, "POST", values),
    successMessage: "Rooms saved",
    redirectTo: ROOM_UI.basePath,
    onSuccess: (r) => r.skipped.length && toast.info(`${r.created} added. Already existed: ${r.skipped.join(", ")}`),
  });
  const start = { ...emptyRoomCreate, hotel: defaultHotel ?? (hotelOptions.length === 1 ? hotelOptions[0].value : "") };
  return (
    <Formik initialValues={start} validationSchema={roomCreateSchema} onSubmit={onSubmit}>
      {({ isSubmitting, setFieldValue }) => (
        <Form noValidate>
          <FormCard
            title="Add Rooms"
            description="Add one room or a whole floor at once, e.g. 101-110, 115"
            badge="Bulk"
            icon={<DoorOpen className="w-4.5 h-4.5" />}
            backHref={ROOM_UI.basePath}
            submitLabel="Add Rooms"
            submitting={isSubmitting}
          >
            <FormSection title="Rooms">
              <SelectField
                name="hotel"
                label="Hotel"
                required
                placeholder="Select hotel"
                options={hotelOptions}
                onChange={(e) => {
                  void setFieldValue("hotel", e.target.value);
                  void setFieldValue("roomType", "");
                }}
              />
              <TypeSelect typeOptions={typeOptions} />
              <TextField name="numbers" label="Room Numbers" required placeholder="101-110, 115" hint="Ranges and commas" />
              <TextField name="floor" label="Floor" placeholder="1" />
            </FormSection>
          </FormCard>
        </Form>
      )}
    </Formik>
  );
}

export function RoomEditForm({ room, typeOptions }: { room: Room; typeOptions: TypeOption[] }) {
  const onSubmit = useApiSubmit<RoomUpdateInput, Room>({
    request: (values) => apiRequest(`${ROOM_UI.apiBase}/${room._id}`, "PUT", values),
    successMessage: "Room updated",
    redirectTo: ROOM_UI.basePath,
  });
  const initial: RoomUpdateInput = {
    roomType: room.roomType?._id ?? "",
    number: room.number,
    floor: room.floor,
    housekeeping: room.housekeeping,
    status: room.status,
  };
  return (
    <Formik initialValues={initial} validationSchema={roomUpdateSchema} onSubmit={onSubmit}>
      {({ isSubmitting }) => (
        <Form noValidate>
          <FormCard
            title={`Edit Room ${room.number}`}
            description={room.hotel?.name}
            badge={room.hotel?.code}
            icon={<DoorOpen className="w-4.5 h-4.5" />}
            backHref={ROOM_UI.basePath}
            submitLabel="Save Room"
            submitting={isSubmitting}
          >
            <FormSection title="Room">
              <TextField name="number" label="Room Number" required maxLength={10} />
              <SelectField name="roomType" label="Room Type" required options={typeOptions.filter((t) => t.hotel === room.hotel?._id)} />
              <TextField name="floor" label="Floor" />
              <SelectField name="housekeeping" label="Housekeeping" required options={HK_OPTIONS} hint="Maintenance rooms cannot be sold" />
              <SelectField name="status" label="Status" required options={STATUS_OPTIONS} />
            </FormSection>
          </FormCard>
        </Form>
      )}
    </Formik>
  );
}
