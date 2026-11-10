"use client";

import { ArrowLeft, Copy, Eye, EyeOff, MessageCircle, Printer } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DownloadPdfButton } from "@/components/print/DownloadPdfButton";
import { pdfFileName } from "@/components/print/pdf";
import { Button } from "@/components/ui/Button";
import type { Booking } from "@/lib/hotelTypes";
import { voucherText, waNumber, whatsappLink } from "@/lib/voucher";
import { BOOKING_BASE } from "./bookingConfig";

const linkBtn = "inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-bold transition";

/** Back / show-hide prices / WhatsApp to guest or agent / copy text / PDF / print */
export function VoucherToolbar({ b, showAmounts, autoDownload }: { b: Booking; showAmounts: boolean; autoDownload?: boolean }) {
  const text = voucherText(b, showAmounts);
  const agentWa = waNumber(b.agent?.phone);
  // Agent bookings without a guest phone carry the agent's number: then it is one "WhatsApp Agent" button
  const guestWa = waNumber(b.guest.phone) === agentWa ? null : waNumber(b.guest.phone);
  const base = `${BOOKING_BASE}/${b._id}/voucher`;

  return (
    <div className="no-print flex flex-wrap items-center gap-2 max-w-[820px] mx-auto">
      <Link href={`${BOOKING_BASE}/${b._id}`} className={`${linkBtn} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
        <ArrowLeft className="w-4 h-4" /> Booking
      </Link>
      <Link
        href={`${base}?amounts=${showAmounts ? "0" : "1"}`}
        replace
        className={`${linkBtn} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
        title={showAmounts ? "Hide prices on the voucher" : "Show total / paid / balance on the voucher"}
      >
        {showAmounts ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {showAmounts ? "Hide Prices" : "Show Prices"}
      </Link>
      <div className="flex-1" />
      {guestWa && (
        <a href={whatsappLink(text, b.guest.phone)} target="_blank" rel="noreferrer" className={`${linkBtn} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}>
          <MessageCircle className="w-4 h-4" /> WhatsApp Guest
        </a>
      )}
      {agentWa && (
        <a
          href={whatsappLink(text, b.agent?.phone)}
          target="_blank"
          rel="noreferrer"
          className={`${linkBtn} border-emerald-600 ${guestWa ? "bg-white text-emerald-700 hover:bg-emerald-50" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp Agent
        </a>
      )}
      {!guestWa && !agentWa && (
        <a href={whatsappLink(text)} target="_blank" rel="noreferrer" className={`${linkBtn} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}>
          <MessageCircle className="w-4 h-4" /> Send on WhatsApp
        </a>
      )}
      <Button
        variant="outline"
        icon={<Copy className="w-4 h-4" />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            toast.success("Voucher text copied");
          } catch {
            toast.error("Could not copy: select the text and copy");
          }
        }}
      >
        Copy Text
      </Button>
      <DownloadPdfButton target=".print-sheet" fileName={pdfFileName("Voucher", b.bookingNo)} autoDownload={autoDownload} />
      <Button variant="outline" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
        Print
      </Button>
    </div>
  );
}
