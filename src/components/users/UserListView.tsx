"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column, type FilterConfig } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { usePermission, useSession } from "@/components/providers/SessionProvider";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Option, Paginated } from "@/lib/types";
import type { UserRecord } from "@/server/services/user.service";
import { USER_UI } from "./userConfig";

interface UserListViewProps {
  data: Paginated<UserRecord>;
  roleOptions: Option[];
}

export function UserListView({ data, roleOptions }: UserListViewProps) {
  const session = useSession();
  const canEdit = usePermission("user", "update");
  const canDelete = usePermission("user", "delete");

  const columns = useMemo<Column<UserRecord>[]>(
    () => [
      {
        key: "name",
        label: "Name",
        render: (r) => (
          <span className="inline-flex items-center gap-2">
            <span className="font-semibold text-slate-900">{r.name}</span>
            {r._id === session._id && <Badge variant="info">You</Badge>}
          </span>
        ),
      },
      { key: "email", label: "Email" },
      { key: "mobile", label: "Mobile" },
      { key: "role", label: "Role", render: (r) => r.role?.name || <span className="text-slate-400">—</span> },
      {
        key: "hotels",
        label: "Hotels",
        sortKey: "allHotels",
        render: (r) =>
          r.allHotels ? (
            <Badge variant="brand">All hotels</Badge>
          ) : (
            <span className="block max-w-[260px] truncate" title={r.hotels.map((h) => h.name).join(", ")}>
              {r.hotels.map((h) => h.name).join(", ") || <span className="text-slate-400">None</span>}
            </span>
          ),
      },
      { key: "status", label: "Status", align: "center", render: (r) => <StatusBadge status={r.status} /> },
      {
        key: "lastLoginAt",
        label: "Last Login",
        render: (r) => (r.lastLoginAt ? formatDateTime(r.lastLoginAt) : <span className="text-slate-400">Never</span>),
      },
      { key: "createdBy", label: "Created By", render: (r) => r.createdBy?.name || <span className="text-slate-400">—</span> },
      { key: "createdAt", label: "Created", render: (r) => formatDate(r.createdAt) },
    ],
    [session._id]
  );

  const filters = useMemo<FilterConfig[]>(
    () => [STATUS_FILTER, { key: "role", allLabel: "All Roles", options: roleOptions, minWidth: "160px" }],
    [roleOptions]
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="users"
      searchPlaceholder="Search users by name, email or mobile..."
      filters={filters}
      rowActions={(row) => (
        <RowActions
          entityLabel={USER_UI.label}
          itemName={row.email}
          viewHref={`${USER_UI.basePath}/${row._id}`}
          editHref={canEdit ? `${USER_UI.basePath}/${row._id}/edit` : undefined}
          deleteUrl={canDelete && row._id !== session._id ? `${USER_UI.apiBase}/${row._id}` : undefined}
        />
      )}
    />
  );
}
