// POST /api/admin/finance/clients/:id/rate-changes: record a change to what
// a client pays, and optionally their term. { effectiveDate, toAmount,
// fromAmount?, termMonths?, note? }. fromAmount defaults to what they were
// paying the day before; it's editable so a change can be recorded after the
// current rate was already updated. termMonths (0, 6 or 12) starts a new term
// on the effective date; leave it out for a change that doesn't.

import { isResponse, requireAdmin } from "../../../../../../lib/admin";
import type { Env } from "../../../../../../lib/auth";
import { getDb } from "../../../../../../db";
import { getRecurringClient } from "../../../../../../db/finance";
import { rateBefore, recordRateChange } from "../../../../../../db/rateChanges";
import { utcToday } from "../../../../../../lib/dates";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const clientId = Number(params.id);
  if (!Number.isInteger(clientId) || clientId < 1) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  if (typeof body.effectiveDate !== "string" || !DATE_RE.test(body.effectiveDate)) {
    return Response.json({ error: "Pick the date the change takes effect" }, { status: 400 });
  }
  const amount = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
  const toAmount = amount(body.toAmount);
  if (toAmount == null) return Response.json({ error: "Invalid new amount" }, { status: 400 });
  if (body.fromAmount !== undefined && body.fromAmount !== null && amount(body.fromAmount) == null) {
    return Response.json({ error: "Invalid previous amount" }, { status: 400 });
  }
  const note =
    typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  let termMonths: number | null = null;
  if (body.termMonths !== undefined && body.termMonths !== null) {
    if (![0, 6, 12].includes(body.termMonths as number)) {
      return Response.json({ error: "Term must be 6 or 12 months, or month-to-month" }, { status: 400 });
    }
    termMonths = body.termMonths as number;
  }

  const db = getDb(env.DB);
  const client = await getRecurringClient(db, clientId);
  if (!client) return Response.json({ error: "Not found" }, { status: 404 });

  const fromAmount =
    amount(body.fromAmount) ??
    (await rateBefore(db, clientId, body.effectiveDate, client.monthlyAmount));
  // A change can be to the term alone, at the same price.
  if (fromAmount === toAmount && termMonths == null) {
    return Response.json(
      { error: "Nothing changes: same amount, and no new term" },
      { status: 400 },
    );
  }

  const change = await recordRateChange(
    db,
    { clientId, effectiveDate: body.effectiveDate, fromAmount, toAmount, termMonths, note },
    utcToday(),
  );
  return Response.json({ change }, { status: 201 });
};
