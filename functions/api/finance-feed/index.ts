// GET /api/finance-feed: the Finance pages' data, for the TMC Finance app's
// server to read. Takes FINANCE_FEED_TOKEN (see lib/financeApp.ts).

import type { Env } from "../../lib/auth";
import { getDb } from "../../db";
import { financeAppDenied } from "../../lib/financeApp";
import { loadFinanceData } from "../../lib/financeData";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const denied = await financeAppDenied(request, env, "read");
  if (denied) return denied;

  const data = await loadFinanceData(getDb(env.DB));
  return Response.json(
    { generatedAt: new Date().toISOString(), ...data },
    { headers: { "Cache-Control": "no-store" } },
  );
};
