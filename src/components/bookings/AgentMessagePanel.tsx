"use client";

import { useFormikContext } from "formik";
import { ClipboardPaste, Copy, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { matchHotel, parseAgentMessage } from "@/lib/agentMessage";
import { MEAL_PLANS } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import type { Option } from "@/lib/types";
import type { BookingInput } from "@/lib/validation/booking.schema";

/** The format agents are asked to send (every line is read by "Fill Form From Message"). */
const AGENT_MESSAGE_FORMAT = `SL NO:
GUEST NAME:
CONTACT NO:
NO OF MEMBERS:  +
LOCATION:
HOTEL NAME:
CHECK IN:
CHECK OUT:
NO OF NIGHTS:
ROOMING:  ROOMS ON  SHARING
MEAL PLAN:
PER HEAD: `;

export interface GroupPlan {
  /** Rooms the agent asked for */
  rooms: number;
  /** People per room (2 double, 3 triple, 4 quad) */
  perRoom: number;
  /** Everyone staying, complimentary included */
  guests: number;
}

/**
 * "Paste the agent's WhatsApp message": fills the booking form from it and tells staff
 * what it understood and what is still to be filled by hand.
 */
export function AgentMessagePanel({ hotelOptions, today, onPlan }: { hotelOptions: Option[]; today: string; onPlan: (p: GroupPlan) => void }) {
  const { values, setValues } = useFormikContext<BookingInput>();
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ got: string[]; missing: string[] } | null>(null);

  const apply = () => {
    const m = parseAgentMessage(text, today);
    const hotel = matchHotel(m.hotelName, hotelOptions);
    const got: string[] = [];
    const missing: string[] = [];
    const next: BookingInput = { ...values };

    if (m.agentRef) {
      next.agentRef = m.agentRef;
      got.push(`Ref ${m.agentRef}`);
    }
    if (m.guestName) {
      next.guestName = m.guestName;
      got.push(`Guest ${m.guestName}`);
    }
    else missing.push("Guest name");
    if (hotel) {
      next.hotel = hotel.value;
      got.push(hotel.label);
    }
    else missing.push(m.hotelName ? `Hotel "${m.hotelName}" (not one of your hotels)` : "Hotel");
    if (m.checkIn && m.checkIn >= today) {
      next.checkIn = m.checkIn;
      next.checkOut = m.checkOut && m.checkOut > m.checkIn ? m.checkOut : nextDay(m.checkIn);
      got.push(`${formatDay(next.checkIn)} → ${formatDay(next.checkOut)}`);
    } else missing.push(m.checkIn ? `Dates (${m.checkIn} is in the past)` : "Dates");
    if (m.mealPlan) {
      next.mealPlan = m.mealPlan;
      got.push(MEAL_PLANS[m.mealPlan].label);
    }
    else missing.push("Meal plan");
    if (m.perHead) {
      next.rateType = "per_head";
      next.perHeadRate = m.perHead;
      got.push(`₹${m.perHead} per head`);
    }
    if (m.focPax !== undefined) next.focPax = m.focPax;
    if (m.pax) got.push(`${m.pax} pax${m.focPax ? ` + ${m.focPax} complimentary` : ""}`);
    if (m.phone) next.phone = m.phone;
    if (m.rooms) got.push(`${m.rooms} rooms${m.perRoom ? `, ${m.perRoom} per room` : ""}`);
    missing.push("Agent");
    if (!m.phone) missing.push("Phone (optional: the agent's phone is used)");

    void setValues(next);
    onPlan({ rooms: m.rooms ?? 0, perRoom: m.perRoom ?? 2, guests: (m.pax ?? 0) + (m.focPax ?? 0) });
    setResult({ got, missing });
    if (got.length) toast.success("Form filled from the message. Check the details, then pick the rooms.");
    else toast.warning("Could not read that message. Fill the form by hand.");
  };

  return (
    <div className="md:col-span-2 lg:col-span-3 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={"Paste the agent's message here, e.g.\nSL NO: B2295 HN\nGUEST NAME: OH MY DAYS\nNO OF MEMBERS: 49 + 2\nCHECK IN: NOV 23 · CHECK OUT: NOV 24\nROOMING: 14 ROOMS ON QUAD SHARING\nMEAL PLAN: MAP · PER HEAD: 450"}
        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:border-brand focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={!text.trim()}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand text-white text-xs font-bold disabled:opacity-50 hover:bg-brand-dark"
        >
          <Sparkles className="w-3.5 h-3.5" /> Fill Form From Message
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              setText(await navigator.clipboard.readText());
            } catch {
              toast.info("Press Ctrl+V (or long-press → Paste) in the box");
            }
          }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <ClipboardPaste className="w-3.5 h-3.5" /> Paste
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(AGENT_MESSAGE_FORMAT);
              toast.success("Format copied: send it to the agent on WhatsApp");
            } catch {
              setText(AGENT_MESSAGE_FORMAT);
              toast.info("Format put in the box: select it and copy");
            }
          }}
          title="Copy the message format to send to agents"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <Copy className="w-3.5 h-3.5" /> Copy Format for Agents
        </button>
      </div>
      {result && (
        <div className="text-[11px] space-y-1">
          {result.got.length > 0 && (
            <p className="text-emerald-700">
              <b>Filled:</b> {result.got.join(" · ")}
            </p>
          )}
          <p className="text-amber-700">
            <b>Check / fill by hand:</b> {result.missing.join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}

function nextDay(day: string) {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
}
