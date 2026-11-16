import Link from "next/link";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/server/auth/session";
import { BIN_LABELS, binModulesFor, listBinItems, type BinModule } from "@/server/services/recycleBin.service";
import { RecycleBinTable } from "./RecycleBinTable";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Admin > Recycle Bin: deleted records of every module the user may delete, one tab per module. */
export async function RecycleBinPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const modules = binModulesFor(user);
  if (!modules.length) return <AccessDenied />;
  const sp = await searchParams;
  const asked = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) as BinModule | undefined;
  const tab = asked && modules.includes(asked) ? asked : modules[0];
  const items = await listBinItems(user, tab);
  return (
    <>
      <PageHeader title="Recycle Bin" description="Everything deleted lands here. Restore it, or (Super Admin) delete it forever." />
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {modules.map((m) => (
          <Link
            key={m}
            href={`/dashboard/admin/recycle-bin?tab=${m}`}
            role="tab"
            aria-selected={m === tab}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-xs font-bold ${m === tab ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {BIN_LABELS[m]}
          </Link>
        ))}
      </div>
      <RecycleBinTable module={tab} label={BIN_LABELS[tab]} items={items} canPurge={user.isSuperAdmin} />
    </>
  );
}
