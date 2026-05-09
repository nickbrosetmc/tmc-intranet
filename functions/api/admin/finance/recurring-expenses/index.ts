import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { createRecurringExpense, listRecurringExpenses } from "../../../../db/finance";
import type { NewRecurringExpenseRow } from "../../../../db/schema";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  return Response.json({ expenses: await listRecurringExpenses(getDb(env.DB)) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  let body: Partial<NewRecurringExpenseRow>;
  try {
    body = (await request.json()) as Partial<NewRecurringExpenseRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.name?.trim() || !Number.isFinite(body.monthlyAmount)) {
    return Response.json({ error: "Name and monthlyAmount required" }, { status: 400 });
  }
  const db = getDb(env.DB);
  const created = await createRecurringExpense(db, {
    name: body.name.trim(),
    monthlyAmount: Math.round(body.monthlyAmount as number),
    categoryId: body.categoryId ?? null,
    paymentDay: body.paymentDay ?? null,
    isActive: body.isActive ?? true,
    notes: body.notes ?? null,
    sortOrder: body.sortOrder ?? 0,
  });
  return Response.json({ expense: created }, { status: 201 });
};
