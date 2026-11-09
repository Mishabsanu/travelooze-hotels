import { Handshake, Plus } from "lucide-react";
import { toDayString } from "@/lib/format";
import { todayIST } from "@/server/services/stay";
import Link from "next/link";
import { BookingListView } from "@/components/bookings/BookingListView";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { StatusBadge } from "@/components/ui/Badge";
import { DetailCard, DetailItem, DetailSection } from "@/components/ui/DetailCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { canBooking, canListBookings } from "@/lib/bookingAccess";
import { formatDateTime, formatINR } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getPageAccess, hotelScope } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { getAgent, listAgents } from "@/server/services/agent.service";
import { listBookings } from "@/server/services/booking/booking.service";
import { listHotelOptions } from "@/server/services/hotel.service";
import { orNotFound } from "@/server/utils/pageData";
import { AGENT_UI } from "./agentConfig";
import { AgentForm, AgentListView } from "./AgentViews";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type IdParams = Promise<{ id: string }>;

const btnClass =
  "inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition";

export async function AgentListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("agent", "view");
  if (!allowed) return <AccessDenied />;
  const data = await listAgents(parseListQuery(await searchParams), hotelScope(user));
  return (
    <>
      <PageHeader
        title={AGENT_UI.plural}
        description={AGENT_UI.description}
        actions={
          can(user, "agent", "create") && (
            <Link href={`${AGENT_UI.basePath}/new`} className={btnClass}>
              <Plus className="w-4 h-4" />
              Add Agent
            </Link>
          )
        }
      />
      <AgentListView data={data} />
    </>
  );
}

export async function AgentCreatePage() {
  const { allowed } = await getPageAccess("agent", "create");
  if (!allowed) return <AccessDenied />;
  return <AgentForm />;
}

export async function AgentEditPage({ params }: { params: IdParams }) {
  const { allowed } = await getPageAccess("agent", "update");
  if (!allowed) return <AccessDenied />;
  return <AgentForm initial={await orNotFound(getAgent((await params).id))} />;
}

export async function AgentDetailPage({ params, searchParams }: { params: IdParams; searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("agent", "view");
  if (!allowed) return <AccessDenied />;
  const { id } = await params;
  const agent = await orNotFound(getAgent(id, hotelScope(user)));
  const showBookings = canListBookings(user);
  const query = parseListQuery(await searchParams, ["hotel", "stay", "mealPlan"]);
  query.filters.agent = id;
  const [bookings, hotelOptions] = showBookings ? await Promise.all([listBookings(query, user, "agent"), listHotelOptions(user)]) : [null, []];
  const over = agent.creditLimit > 0 && agent.balance.due > agent.creditLimit;

  return (
    <div className="space-y-5">
      <DetailCard
        title={agent.name}
        subtitle={agent.code}
        badge={<StatusBadge status={agent.status} />}
        icon={<Handshake className="w-4.5 h-4.5" />}
        backHref={AGENT_UI.basePath}
        editHref={can(user, "agent", "update") ? `${AGENT_UI.basePath}/${agent._id}/edit` : undefined}
      >
        <DetailSection title="Account">
          <DetailItem label="Total Billed" value={formatINR(agent.balance.billed)} />
          <DetailItem label="Received" value={formatINR(agent.balance.paid)} />
          <DetailItem
            label="Outstanding"
            value={<span className={over ? "text-rose-600" : agent.balance.due > 0 ? "text-amber-700" : ""}>{formatINR(agent.balance.due)}</span>}
          />
          <DetailItem label="Credit Limit" value={agent.creditLimit ? formatINR(agent.creditLimit) : "Prepaid (no credit)"} />
          <DetailItem label="Contract Discount" value={`${agent.discountPercent}%`} />
          <DetailItem label="Bookings" value={agent.balance.count} />
        </DetailSection>
        <DetailSection title="Contact">
          <DetailItem label="Contact Person" value={agent.contactPerson} />
          <DetailItem label="Phone" value={agent.phone} />
          <DetailItem label="Email" value={agent.email} />
          <DetailItem label="GSTIN" value={agent.gstin} mono />
          <DetailItem label="Address" value={agent.address} />
        </DetailSection>
        <DetailSection title="Audit">
          <DetailItem label="Created By" value={agent.createdBy?.name} />
          <DetailItem label="Created" value={formatDateTime(agent.createdAt)} />
          <DetailItem label="Last Updated" value={formatDateTime(agent.updatedAt)} />
        </DetailSection>
      </DetailCard>

      {bookings && (
        <>
          <PageHeader
            title="Bookings of this agent"
            actions={
              canBooking(user, "agent", "create") &&
              agent.status === "active" && (
                <Link href={`/dashboard/sales/agent-bookings/new?agent=${agent._id}`} className={btnClass}>
                  <Plus className="w-4 h-4" />
                  New Booking
                </Link>
              )
            }
          />
          <BookingListView data={bookings} hotelOptions={hotelOptions} agentOnly today={toDayString(todayIST())} />
        </>
      )}
    </div>
  );
}
