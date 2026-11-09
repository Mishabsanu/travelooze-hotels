"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { usePermission } from "@/components/providers/SessionProvider";
import { formatDate, formatNumber } from "@/lib/format";
import type { Paginated, Role } from "@/lib/types";
import { ROLE_UI } from "./roleConfig";

export function RoleListView({ data }: { data: Paginated<Role> }) {
  const canEdit = usePermission("role", "update");
  const canDelete = usePermission("role", "delete");

  const columns = useMemo<Column<Role>[]>(
    () => [
      {
        key: "name",
        label: "Role Name",
        render: (r) => (
          <span className="inline-flex items-center gap-2">
            <span className="font-semibold text-slate-900">{r.name}</span>
            {r.isSuperAdmin && <Badge variant="brand">Super Admin</Badge>}
          </span>
        ),
      },
      {
        key: "description",
        label: "Description",
        render: (r) => <span className="block max-w-[360px] truncate" title={r.description}>{r.description || "—"}</span>,
      },
      {
        key: "accessCount",
        label: "Access Rights",
        render: (r) => (
          <span className="inline-flex items-center gap-1.5">
            {r.isSuperAdmin && <Badge variant="success">Global Access</Badge>}
            <Badge variant="neutral">{formatNumber(r.accessCount ?? 0)} Modules</Badge>
          </span>
        ),
      },
      { key: "userCount", label: "Users", align: "center", render: (r) => formatNumber(r.userCount) },
      { key: "status", label: "Status", align: "center", render: (r) => <StatusBadge status={r.status} /> },
      { key: "createdBy", label: "Created By", render: (r) => r.createdBy?.name || "—" },
      { key: "createdAt", label: "Created", render: (r) => formatDate(r.createdAt) },
    ],
    []
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="roles"
      searchPlaceholder="Search roles by name or description..."
      filters={[STATUS_FILTER]}
      rowActions={(row) => (
        <RowActions
          entityLabel={ROLE_UI.label}
          itemName={row.name}
          viewHref={`${ROLE_UI.basePath}/${row._id}`}
          editHref={canEdit ? `${ROLE_UI.basePath}/${row._id}/edit` : undefined}
          deleteUrl={canDelete && !row.isSuperAdmin ? `${ROLE_UI.apiBase}/${row._id}` : undefined}
        />
      )}
    />
  );
}
