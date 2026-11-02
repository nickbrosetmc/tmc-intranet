// GET /api/finance-feed: the Finance pages' data, for the TMC Finance app's
// server to read. Not for people or agents: it takes FINANCE_FEED_TOKEN, a
// secret shared with that app alone, instead of a session or an API token,
// so no one's sign-in or agent token reaches it, and deleting the secret
// turns the feed off (404).

import type { Env } from "../lib/auth";
import { getDb } from "../db";
import { loadFinanceData } from "../lib/financeData";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const expected = env.FINANCE_FEED_TOKEN;
  if (!expected) return Response.json({ error: "Not found" }, { status: 404 });

  const header = request.headers.get("Authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!given || !(await sameSecret(given, expected))) {
    return Response.json({ error: "Invalid feed token" }, { status: 401 });
  }

  const data = await loadFinanceData(getDb(env.DB));
  return Response.json(
    { generatedAt: new Date().toISOString(), ...data },
    { headers: { "Cache-Control": "no-store" } },
  );
};

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
