import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import { loadFinanceData } from "../../../lib/financeData";

/**
 * One-shot dashboard payload. Cashflow projection is computed client-side
 * so adjusting the starting balance doesn't require a roundtrip.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  return Response.json(await loadFinanceData(getDb(env.DB)));
};
