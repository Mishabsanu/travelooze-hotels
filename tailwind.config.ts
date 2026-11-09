import type { Config } from "tailwindcss";

/**
 * Same design tokens as Proserve ERP (Sentinel iWMS shell): purple brand header, navy rail, compact grid tables.
 * Tailwind v3 is used because Windows Application Control blocks v4's native scanner on this machine.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#5439a3", dark: "#432a87", light: "#f3effc", border: "#d8b4fe" },
        rail: { DEFAULT: "#0c1b2a", header: "#08121d", hover: "#112438", active: "#183654", border: "#15273b" },
        line: "#e5e7eb",
        canvas: "#f8fafc",
        head: "#f9fafb",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "Plus Jakarta Sans", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-mono-face)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      spacing: { 4.5: "1.125rem" },
      boxShadow: { xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)" },
      backdropBlur: { xs: "2px" },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-left": { from: { transform: "translateX(100%)", opacity: "0.8" }, to: { transform: "translateX(0)", opacity: "1" } },
      },
      animation: {
        "fade-in": "fade-in 0.18s ease-out",
        "slide-left": "slide-left 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
