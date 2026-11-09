export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors?: Record<string, string>
  ) {
    super(message);
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** fetch wrapper for the app's own /api routes (session cookie is sent automatically). */
export async function apiRequest<T = unknown>(url: string, method: Method = "GET", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("Network error. Check your connection and try again.", 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Session expired → back to login. Not on the login page itself, where 401 means "wrong password"
    // and the message must be shown instead of reloading the page.
    if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(data.error || "Request failed", res.status, data.fieldErrors);
  }
  return data as T;
}

/** Create / update / delete helpers for one REST resource, e.g. resourceApi("/api/customers"). */
export function resourceApi<T>(base: string) {
  return {
    create: (body: unknown) => apiRequest<T>(base, "POST", body),
    update: (id: string, body: unknown) => apiRequest<T>(`${base}/${id}`, "PUT", body),
    remove: (id: string) => apiRequest<{ success: boolean }>(`${base}/${id}`, "DELETE"),
  };
}
