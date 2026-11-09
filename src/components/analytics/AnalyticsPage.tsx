import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth/session";
import { getAnalytics, type GroupBy } from "@/server/services/analytics.service";
import { addDays, parseDay, todayIST } from "@/server/services/stay";
import { PRESETS } from "./analyticsConfig";
import { AnalyticsFilters, KpiRow, RankedCard, TrendCharts } from "./AnalyticsViews";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const GROUPS: GroupBy[] = ["day", "week", "month", "year"];

/** Period presets → date range and the natural grouping (the "Group by" buttons override it). */
function resolvePeriod(sp: Record<string, string | string[] | undefined>) {
  const today = todayIST();
  const preset = PRESETS.some((p) => p.value === first(sp.period)) ? first(sp.period)! : "30d";
  let from = addDays(today, -29);
  let to = today;
  let by: GroupBy = "day";
  if (preset === "7d") from = addDays(today, -6);
  if (preset === "mtd") from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  if (preset === "90d") [from, by] = [addDays(today, -89), "week"];
  if (preset === "12w") [from, by] = [addDays(today, -83), "week"];
  if (preset === "ytd") [from, by] = [new Date(Date.UTC(today.getUTCFullYear(), 0, 1)), "month"];
  if (preset === "12m") [from, by] = [new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth() + 1, 1)), "month"];
  if (preset === "custom") {
    try {
      if (first(sp.from)) from = parseDay(first(sp.from)!);
      if (first(sp.to)) to = parseDay(first(sp.to)!);
    } catch {}
    if (to < from) [from, to] = [to, from];
    const days = (to.getTime() - from.getTime()) / 86_400_000;
    by = days > 400 ? "year" : days > 92 ? "month" : days > 31 ? "week" : "day";
  }
  // keep the range sane (at most ~5 years)
  if (to.getTime() - from.getTime() > 1830 * 86_400_000) from = addDays(to, -1830);
  const asked = first(sp.by) as GroupBy | undefined;
  if (asked && GROUPS.includes(asked)) by = asked;
  // daily buckets over a long range are unreadable: step up
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (by === "day" && days > 120) by = "week";
  if (by === "week" && days > 730) by = "month";
  return { preset, from, to, by };
}

export async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!can(user, "report", "view")) return <AccessDenied message="Analytics needs the Reports permission." />;
  const { preset, from, to, by } = resolvePeriod(await searchParams);
  const a = await getAnalytics(user, from, to, by);

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Revenue, occupancy and what sells best · ${user.allHotels ? "all hotels" : `${user.hotelIds.length} hotel(s)`} · compared with the previous ${a.buckets.length} ${by}(s)`}
      />
      <AnalyticsFilters preset={preset} groupBy={by} from={a.from} to={a.to} />
      <KpiRow a={a} />
      <TrendCharts a={a} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RankedCard title="Most profitable hotels" subtitle="Room revenue excl. GST" rows={a.byHotel} />
        <RankedCard title="Room types" subtitle="Which rooms earn the most" rows={a.byRoomType} />
        <RankedCard title="Top B2B agents" subtitle="Revenue from agent bookings" rows={a.byAgent} empty="No agent stays in this period" />
        <RankedCard title="Meal plans" subtitle="EP / CP / MAP / AP" rows={a.byMealPlan} />
      </div>
      <p className="text-[11px] text-slate-400">
        Profit needs costs (salaries, power, laundry…), which the app does not record yet; revenue, ADR and RevPAR show where the money comes from.
      </p>
    </>
  );
}
