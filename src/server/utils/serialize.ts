import "server-only";

/**
 * Converts lean Mongoose results (ObjectId, Date) into plain JSON so they can be
 * passed from Server Components to Client Components.
 */
export function toPlain<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
