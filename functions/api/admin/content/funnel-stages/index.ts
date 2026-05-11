import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { createFunnelStage, listFunnelStages } from "../../../../db/content";
import type { NewFunnelStageRow } from "../../../../db/schema";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  return Response.json({ funnelStages: await listFunnelStages(getDb(env.DB)) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  let body: Partial<NewFunnelStageRow>;
  try {
    body = (await request.json()) as Partial<NewFunnelStageRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return Response.json({ error: "Name required" }, { status: 400 });
  }
  const created = await createFunnelStage(getDb(env.DB), {
    name: body.name.trim(),
    description: body.description ?? null,
    color: body.color ?? "404E5C",
    sortOrder: body.sortOrder ?? 0,
  });
  return Response.json({ funnelStage: created }, { status: 201 });
};
