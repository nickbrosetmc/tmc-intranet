import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { createCategory, listExpenseCategories } from "../../../../db/finance";
import type { NewExpenseCategoryRow } from "../../../../db/schema";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  return Response.json({ categories: await listExpenseCategories(getDb(env.DB)) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  let body: Partial<NewExpenseCategoryRow>;
  try {
    body = (await request.json()) as Partial<NewExpenseCategoryRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return Response.json({ error: "Name required" }, { status: 400 });
  }
  const created = await createCategory(getDb(env.DB), {
    name: body.name.trim(),
    monthlyBudget: body.monthlyBudget ?? null,
    color: body.color ?? "404E5C",
    sortOrder: body.sortOrder ?? 0,
  });
  return Response.json({ category: created }, { status: 201 });
};
