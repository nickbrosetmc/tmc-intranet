import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import {
  createRecurringClient,
  listRecurringClients,
} from "../../../../db/finance";
import { datesInOrder, parseClientFields } from "../../../../lib/clientFields";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  return Response.json({ clients: await listRecurringClients(db) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseClientFields(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const f = parsed.fields;
  if (!f.name || f.monthlyAmount === undefined) {
    return Response.json(
      { error: "Name and monthlyAmount required" },
      { status: 400 },
    );
  }
  if (!datesInOrder(f.signedDate, f.endedDate)) {
    return Response.json({ error: "The end date can't be before the signed date" }, { status: 400 });
  }

  const db = getDb(env.DB);
  const created = await createRecurringClient(db, {
    name: f.name,
    monthlyAmount: f.monthlyAmount,
    paymentMethodId: f.paymentMethodId ?? null,
    invoiceDay: f.invoiceDay ?? null,
    isActive: f.isActive ?? true,
    notes: f.notes ?? null,
    sortOrder: f.sortOrder ?? 0,
    // Content-planner fields, so a client can be created straight from
    // the planner settings with their schedule already in place.
    weeklyPostTarget: f.weeklyPostTarget ?? null,
    postingDays: f.postingDays ?? null,
    signedDate: f.signedDate ?? null,
    termMonths: f.termMonths ?? null,
    endedDate: f.endedDate ?? null,
    ltvAdjustment: f.ltvAdjustment ?? null,
  });
  return Response.json({ client: created }, { status: 201 });
};
