import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { createOneTimeExpense, listOneTimeExpenses } from "../../../../db/finance";
import type { NewOneTimeExpenseRow } from "../../../../db/schema";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  return Response.json({ expenses: await listOneTimeExpenses(getDb(env.DB)) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  let body: Partial<NewOneTimeExpenseRow>;
  try {
    body = (await request.json()) as Partial<NewOneTimeExpenseRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.name?.trim() || !Number.isFinite(body.amount)) {
    return Response.json({ error: "Name and amount required" }, { status: 400 });
  }
  const status = body.status === "paid" ? "paid" : "planned";
  const db = getDb(env.DB);
  const created = await createOneTimeExpense(db, {
    name: body.name.trim(),
    categoryId: body.categoryId ?? null,
    amount: Math.round(body.amount as number),
    status,
    plannedDate: body.plannedDate ?? null,
    paidDate: body.paidDate ?? null,
    notes: body.notes ?? null,
  });
  return Response.json({ expense: created }, { status: 201 });
};
