// POST /api/finance-feed/rate-changes: a pending rate increase in TMC Finance
// was made real. { clientId, effectiveDate, toAmount, termMonths? }. The
// same rules as recording one on a client's profile: the previous amount is
// what they paid the day before, and a change dated today or earlier moves
// the current rate. Takes FINANCE_WRITE_TOKEN (see lib/financeApp.ts).
//
// The same change sent twice (client, date and amount) returns the first one
// rather than recording it again.

import { and, eq } from "drizzle-orm";
import type { Env } from "../../lib/auth";
import { getDb } from "../../db";
import { getRecurringClient } from "../../db/finance";
import { rateBefore, recordRateChange } from "../../db/rateChanges";
import { clientRateChanges } from "../../db/schema";
import { utcToday } from "../../lib/dates";
import { financeAppDenied, onBehalfOf } from "../../lib/financeApp";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = await financeAppDenied(request, env, "write");
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const clientId = body.clientId;
  if (typeof clientId !== "number" || !Number.isInteger(clientId) || clientId < 1) {
    return Response.json({ error: "Invalid client" }, { status: 400 });
  }
  if (typeof body.effectiveDate !== "string" || !DATE_RE.test(body.effectiveDate)) {
    return Response.json({ error: "Pick the date the change takes effect" }, { status: 400 });
  }
  const effectiveDate = body.effectiveDate;
  const toAmount = body.toAmount;
  if (typeof toAmount !== "number" || !Number.isFinite(toAmount) || toAmount < 0) {
    return Response.json({ error: "Invalid new amount" }, { status: 400 });
  }
  let termMonths: number | null = null;
  if (body.termMonths !== undefined && body.termMonths !== null) {
    if (![0, 6, 12].includes(body.termMonths as number)) {
      return Response.json({ error: "Term must be 6 or 12 months, or month-to-month" }, { status: 400 });
    }
    termMonths = body.termMonths as number;
  }

  const db = getDb(env.DB);
  const client = await getRecurringClient(db, clientId);
  if (!client) return Response.json({ error: "That client isn't in the Tech Hub" }, { status: 404 });

  const rounded = Math.round(toAmount);
  const same = await db
    .select()
    .from(clientRateChanges)
    .where(
      and(
        eq(clientRateChanges.clientId, clientId),
        eq(clientRateChanges.effectiveDate, effectiveDate),
        eq(clientRateChanges.toAmount, rounded),
      ),
    )
    .get();
  if (same) return Response.json({ change: same, existing: true });

  const fromAmount = await rateBefore(db, clientId, effectiveDate, client.monthlyAmount);
  if (fromAmount === rounded && termMonths == null) {
    return Response.json({ error: "Nothing changes: they already pay that amount" }, { status: 400 });
  }
  const by = onBehalfOf(request);
  const change = await recordRateChange(
    db,
    { clientId, effectiveDate, fromAmount, toAmount: rounded, termMonths, note: `From a TMC Finance pipeline deal, by ${by}.` },
    utcToday(),
  );
  console.log(JSON.stringify({ msg: "finance app recorded rate change", id: change.id, clientId, by }));
  return Response.json({ change }, { status: 201 });
};
