import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import {
  createRecurringClient,
  listRecurringClients,
} from "../../../../db/finance";
import type { NewRecurringClientRow } from "../../../../db/schema";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  return Response.json({ clients: await listRecurringClients(db) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  let body: Partial<NewRecurringClientRow>;
  try {
    body = (await request.json()) as Partial<NewRecurringClientRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.name?.trim() || !Number.isFinite(body.monthlyAmount)) {
    return Response.json(
      { error: "Name and monthlyAmount required" },
      { status: 400 },
    );
  }

  const db = getDb(env.DB);
  const created = await createRecurringClient(db, {
    name: body.name.trim(),
    monthlyAmount: Math.round(body.monthlyAmount as number),
    paymentMethodId: body.paymentMethodId ?? null,
    invoiceDay: body.invoiceDay ?? null,
    isActive: body.isActive ?? true,
    notes: body.notes ?? null,
    sortOrder: body.sortOrder ?? 0,
  });
  return Response.json({ client: created }, { status: 201 });
};
