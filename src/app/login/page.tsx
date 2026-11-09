import { APP_NAME, LOGO_SRC } from "@/lib/brand";
import { redirect } from "next/navigation";
import { BedDouble, Handshake, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "Sign in" };

/** Only same-site relative paths are allowed as a post-login destination. */
function safeNext(next?: string | string[]): string {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith("/dashboard") ? value : "/dashboard";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  const features = [
    { icon: BedDouble, text: "Walk-in bookings, check-in and check-out" },
    { icon: Handshake, text: "B2B agents with contract rates and credit" },
    { icon: ShieldCheck, text: "Role-based access for every module and hotel" },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-canvas">
      <div className="hidden lg:flex flex-col justify-between bg-rail text-white p-12 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-brand/40 blur-3xl" />
        <div className="relative">
          {/* Logo in white straight on the dark panel (no box), same style as the side rail */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt={APP_NAME} className="h-20 w-auto brightness-0 invert" />
        </div>
        <div className="relative space-y-6">
          <h1 className="text-3xl font-black leading-tight">
            Run every hotel, room and booking
            <br />
            from one workspace.
          </h1>
          <ul className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="w-8 h-8 rounded-lg bg-rail-active border border-[#2b5175] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-sky-300" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[11px] text-slate-500 relative">© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-black text-slate-900">Welcome back</h2>
          <p className="text-xs text-slate-500 mt-1 mb-6">Sign in with your email or mobile number.</p>
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
