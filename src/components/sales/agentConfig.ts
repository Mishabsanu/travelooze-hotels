/** Shared by server and client components (no "use client": plain values must not live in client files). */
export const AGENT_UI = {
  label: "Agent",
  plural: "B2B Agents Master",
  basePath: "/dashboard/sales/agents",
  apiBase: "/api/agents",
  description: "Travel agents and corporate partners: contract discount, credit limit and outstanding",
} as const;
