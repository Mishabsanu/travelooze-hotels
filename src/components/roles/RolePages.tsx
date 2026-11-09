import { Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { DetailCard, DetailItem, DetailSection } from "@/components/ui/DetailCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { can, PERMISSION_MODULES } from "@/lib/permissions";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { getRole, listRoles } from "@/server/services/role.service";
import { orNotFound } from "@/server/utils/pageData";
import { PermissionMatrix } from "./PermissionMatrix";
import { countGranted, toGrid, TOTAL_PERMISSIONS } from "./permissionUtils";
import { RoleForm } from "./RoleForm";
import { RoleListView } from "./RoleListView";
import { ROLE_UI, SUPER_ADMIN_NOTE } from "./roleConfig";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type IdParams = Promise<{ id: string }>;

export async function RoleListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("role", "view");
  if (!allowed) return <AccessDenied />;
  const data = await listRoles(parseListQuery(await searchParams));

  return (
    <>
      <PageHeader
        title={ROLE_UI.plural}
        description={ROLE_UI.description}
        breadcrumb="Administration"
        actions={
          can(user, "role", "create") && (
            <Link
              href={`${ROLE_UI.basePath}/new`}
              className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Add Role
            </Link>
          )
        }
      />
      <RoleListView data={data} />
    </>
  );
}

export async function RoleCreatePage() {
  const { allowed } = await getPageAccess("role", "create");
  if (!allowed) return <AccessDenied />;
  return <RoleForm />;
}

export async function RoleEditPage({ params }: { params: IdParams }) {
  const { allowed } = await getPageAccess("role", "update");
  if (!allowed) return <AccessDenied />;
  const role = await orNotFound(getRole((await params).id));
  return <RoleForm initial={role} />;
}

export async function RoleDetailPage({ params }: { params: IdParams }) {
  const { user, allowed } = await getPageAccess("role", "view");
  if (!allowed) return <AccessDenied />;
  const role = await orNotFound(getRole((await params).id));
  const granted = countGranted(toGrid(role.permissions));

  return (
    <DetailCard
      title={role.name}
      subtitle={role.isSuperAdmin ? "Global Access role" : "Custom role"}
      badge={
        <>
          {role.isSuperAdmin && <Badge variant="brand">Super Admin</Badge>}
          <StatusBadge status={role.status} />
        </>
      }
      icon={<ShieldCheck className="w-4.5 h-4.5" />}
      backHref={ROLE_UI.basePath}
      editHref={can(user, "role", "update") ? `${ROLE_UI.basePath}/${role._id}/edit` : undefined}
    >
      <DetailSection title="Role Details">
        <DetailItem label="Role Name" value={role.name} />
        <DetailItem label="Status" value={<StatusBadge status={role.status} />} />
        <DetailItem label="Type" value={role.isSuperAdmin ? "Super Admin / Global Access" : "Custom"} />
        <DetailItem label="Description" value={role.description} />
        <DetailItem label="Created By" value={role.createdBy?.name} />
      </DetailSection>

      <DetailSection title="Summary">
        <DetailItem label="Users Assigned" value={formatNumber(role.userCount)} />
        <DetailItem label="Modules With Access" value={`${granted.modules} of ${PERMISSION_MODULES.length}`} />
        <DetailItem label="Permissions Granted" value={`${granted.permissions} of ${TOTAL_PERMISSIONS}`} />
      </DetailSection>

      <section className="space-y-3">
        <h2 className="text-xs font-bold text-brand uppercase tracking-wider pb-1.5 border-b border-slate-100">Permissions</h2>
        <PermissionMatrix value={role.permissions} readOnly note={role.isSuperAdmin ? SUPER_ADMIN_NOTE : undefined} />
      </section>

      <DetailSection title="Audit">
        <DetailItem label="Created" value={formatDateTime(role.createdAt)} />
        <DetailItem label="Last Updated" value={formatDateTime(role.updatedAt)} />
      </DetailSection>
    </DetailCard>
  );
}
