// The TMC Finance app's access to the hub. Two secrets, each shared with
// that app alone, and neither a person's session nor an agent API token:
//   FINANCE_FEED_TOKEN  reads the Finance pages' data (/api/finance-feed)
//   FINANCE_WRITE_TOKEN creates clients and rate changes when a pending deal
//                       there is made real, and nothing else
// Deleting a secret turns its routes off (404), so reading can stay on
// while writing is off.

import type { Env } from "./auth";

type Access = "read" | "write";

/** Null when the request carries the right secret; otherwise the response to send. */
export async function financeAppDenied(request: Request, env: Env, access: Access): Promise<Response | null> {
  const expected = access === "read" ? env.FINANCE_FEED_TOKEN : env.FINANCE_WRITE_TOKEN;
  if (!expected) return Response.json({ error: "Not found" }, { status: 404 });
  const header = request.headers.get("Authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!given || !(await sameSecret(given, expected))) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }
  return null;
}

/**
 * Who in the finance app asked, for notes and logs. The finance app vouches
 * for it; it grants nothing here.
 */
export function onBehalfOf(request: Request): string {
  const v = request.headers.get("X-On-Behalf-Of") ?? "";
  return /^[^\s@<>]{1,64}@[^\s@<>]{1,190}$/.test(v) ? v : "TMC Finance";
}

/**
 * Constant-time comparison. Hashing first gives both sides the same length,
 * which timingSafeEqual needs, without the length check leaking anything.
 */
async function sameSecret(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}
