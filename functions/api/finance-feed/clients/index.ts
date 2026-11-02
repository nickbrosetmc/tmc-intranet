// POST /api/finance-feed/clients: a client added in TMC Finance, where clients
// are edited now (by hand, or a pending deal made real). { name,
// monthlyAmount, signedDate, termMonths?, invoiceDay?, paymentMethodId?,
// ltvAdjustment?, notes? }, checked by the same rules as everywhere else.
// Takes FINANCE_WRITE_TOKEN (see lib/financeApp.ts).
//
// A client with the same name already here is a 409 carrying its id, so a
// double-click never makes two.

import { sql } from "drizzle-orm";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import { createRecurringClient } from "../../../db/finance";
import { recurringClients } from "../../../db/schema";
import { financeAppDenied, onBehalfOf } from "../../../lib/financeApp";
import { parseClientFields } from "../../../lib/clientFields";

const ALLOWED = ["name", "monthlyAmount", "signedDate", "termMonths", "invoiceDay", "paymentMethodId", "ltvAdjustment", "notes"];

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = await financeAppDenied(request, env, "write");
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const picked = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)));
  const parsed = parseClientFields(picked);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const f = parsed.fields;
  if (!f.name || f.monthlyAmount === undefined || !f.signedDate) {
    return Response.json({ error: "Name, monthly amount and start date are required" }, { status: 400 });
  }

  const db = getDb(env.DB);
  const existing = await db
    .select({ id: recurringClients.id, name: recurringClients.name })
    .from(recurringClients)
    .where(sql`lower(trim(${recurringClients.name})) = ${f.name.toLowerCase()}`)
    .get();
  if (existing) {
    return Response.json(
      { error: `${existing.name} is already a client`, clientId: existing.id },
      { status: 409 },
    );
  }

  const by = onBehalfOf(request);
  const created = await createRecurringClient(db, {
    name: f.name,
    monthlyAmount: f.monthlyAmount,
    signedDate: f.signedDate,
    termMonths: f.termMonths ?? null,
    invoiceDay: f.invoiceDay ?? Number(f.signedDate.slice(8, 10)),
    paymentMethodId: f.paymentMethodId ?? null,
    ltvAdjustment: f.ltvAdjustment ?? null,
    isActive: true,
    // A deal made real sends no notes; say where it came from.
    notes: "notes" in body ? (f.notes ?? null) : `Added from a TMC Finance pipeline deal by ${by}.`,
  });
  console.log(JSON.stringify({ msg: "finance app created client", id: created.id, by }));
  return Response.json({ client: created }, { status: 201 });
};
