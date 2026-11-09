/** Shared by server and client (no "use client": plain values must not live in client files). */
export const PRESETS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "mtd", label: "This month" },
  { value: "90d", label: "Last 90 days" },
  { value: "12w", label: "Last 12 weeks" },
  { value: "ytd", label: "This year" },
  { value: "12m", label: "Last 12 months" },
  { value: "custom", label: "Custom dates" },
];
