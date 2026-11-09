import { Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { DetailCard, DetailItem, DetailSection } from "@/components/ui/DetailCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import type { Option } from "@/lib/types";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { listAllHotelOptions } from "@/server/services/hotel.service";
import { listRoleOptions, listSuperAdminRoleIds } from "@/server/services/role.service";
import { getUser, listUsers, type UserRecord } from "@/server/services/user.service";
import { orNotFound } from "@/server/utils/pageData";
import { UserForm } from "./UserForm";
import { UserListView } from "./UserListView";
import { USER_UI } from "./userConfig";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type IdParams = Promise<{ id: string }>;

export async function UserListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("user", "view");
  if (!allowed) return <AccessDenied />;
  const [data, roleOptions] = await Promise.all([
    listUsers(parseListQuery(await searchParams, ["role"])),
    listRoleOptions({ includeInactive: true }),
  ]);

  return (
    <>
      <PageHeader
        title={USER_UI.plural}
        description={USER_UI.description}
        breadcrumb="Administration"
        actions={
          can(user, "user", "create") && (
            <Link
              href={`${USER_UI.basePath}/new`}
              className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Add User
            </Link>
          )
        }
      />
      <UserListView data={data} roleOptions={roleOptions} />
    </>
  );
}

export async function UserCreatePage() {
  const { allowed } = await getPageAccess("user", "create");
  if (!allowed) return <AccessDenied />;
  const [roleOptions, hotelOptions, superAdminRoleIds] = await Promise.all([listRoleOptions(), listAllHotelOptions(), listSuperAdminRoleIds()]);
  return <UserForm roleOptions={roleOptions} hotelOptions={hotelOptions} superAdminRoleIds={superAdminRoleIds} />;
}

/** Keeps the user's current role selectable even if it has since been deactivated. */
function withCurrentRole(options: Option[], user: UserRecord): Option[] {
  const role = user.role;
  if (!role || options.some((o) => o.value === role._id)) return options;
  return [...options, { value: role._id, label: `${role.name} (inactive)` }];
}

export async function UserEditPage({ params }: { params: IdParams }) {
  const { allowed } = await getPageAccess("user", "update");
  if (!allowed) return <AccessDenied />;
  const { id } = await params;
  const [record, roleOptions, hotelOptions, superAdminRoleIds] = await Promise.all([
    orNotFound(getUser(id)),
    listRoleOptions(),
    listAllHotelOptions(),
    listSuperAdminRoleIds(),
  ]);
  return (
    <UserForm
      initial={record}
      roleOptions={withCurrentRole(roleOptions, record)}
      hotelOptions={hotelOptions}
      superAdminRoleIds={superAdminRoleIds}
    />
  );
}

export async function UserDetailPage({ params }: { params: IdParams }) {
  const { user, allowed } = await getPageAccess("user", "view");
  if (!allowed) return <AccessDenied />;
  const record = await orNotFound(getUser((await params).id));

  return (
    <DetailCard
      title={record.name}
      subtitle={record.email}
      badge={
        <>
          {record._id === user._id && <Badge variant="info">You</Badge>}
          <StatusBadge status={record.status} />
        </>
      }
      icon={<UserRound className="w-4.5 h-4.5" />}
      backHref={USER_UI.basePath}
      editHref={can(user, "user", "update") ? `${USER_UI.basePath}/${record._id}/edit` : undefined}
    >
      <DetailSection title="Account">
        <DetailItem label="Full Name" value={record.name} />
        <DetailItem label="Email" value={record.email} />
        <DetailItem label="Mobile" value={record.mobile} />
        <DetailItem
          label="Role"
          value={
            record.role && can(user, "role", "view") ? (
              <Link href={`/dashboard/admin/roles/${record.role._id}`} className="text-brand hover:underline">
                {record.role.name}
              </Link>
            ) : (
              record.role?.name
            )
          }
        />
        <DetailItem label="Status" value={<StatusBadge status={record.status} />} />
      </DetailSection>
      <DetailSection title="Hotels">
        <DetailItem
          label="Works At"
          value={record.allHotels ? "All hotels" : record.hotels.map((h) => h.name).join(", ") || "No hotel assigned"}
        />
      </DetailSection>
      <DetailSection title="Activity">
        <DetailItem label="Last Login" value={record.lastLoginAt ? formatDateTime(record.lastLoginAt) : "Never"} />
        <DetailItem label="Created" value={formatDateTime(record.createdAt)} />
        <DetailItem label="Last Updated" value={formatDateTime(record.updatedAt)} />
      </DetailSection>
    </DetailCard>
  );
}
