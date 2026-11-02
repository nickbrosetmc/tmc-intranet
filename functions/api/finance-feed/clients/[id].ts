// PATCH /api/finance-feed/clients/:id: a client edited in TMC Finance. Any of
// name, invoiceDay, paymentMethodId, isActive, signedDate, termMonths,
// endedDate, ltvAdjustment and notes. What they pay changes through a rate
// change (/api/finance-feed/rate-changes), so the history keeps every rate.
// Takes FINANCE_WRITE_TOKEN (see lib/financeApp.ts).

import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import { getRecurringClient, updateRecurringClient } from "../../../db/finance";
import { datesInOrder, parseClientFields } from "../../../lib/clientFields";
import { financeAppDenied, onBehalfOf } from "../../../lib/financeApp";

const ALLOWED = ["name", "invoiceDay", "paymentMethodId", "isActive", "signedDate", "termMonths", "endedDate", "ltvAdjustment", "notes"];

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const denied = await financeAppDenied(request, env, "write");
  if (denied) return denied;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Invalid id" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const picked = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)));
  const parsed = parseClientFields(picked);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const db = getDb(env.DB);
  const existing = await getRecurringClient(db, id);
  if (!existing) return Response.json({ error: "That client isn't in the Tech Hub" }, { status: 404 });
  const f = parsed.fields;
  const signed = f.signedDate !== undefined ? f.signedDate : existing.signedDate;
  const ended = f.endedDate !== undefined ? f.endedDate : existing.endedDate;
  if (!datesInOrder(signed, ended)) {
    return Response.json({ error: "The left date can't be before the start date" }, { status: 400 });
  }

  await updateRecurringClient(db, id, f);
  const by = onBehalfOf(request);
  console.log(JSON.stringify({ msg: "finance app updated client", id, fields: Object.keys(f), by }));
  return Response.json({ client: await getRecurringClient(db, id) });
};
