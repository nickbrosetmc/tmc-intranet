import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { createContentPost } from "../../../../db/content";
import type { NewContentPostRow } from "../../../../db/schema";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  let body: Partial<NewContentPostRow>;
  try {
    body = (await request.json()) as Partial<NewContentPostRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.clientId || !body.title?.trim() || !body.scheduledDate) {
    return Response.json(
      { error: "clientId, title, and scheduledDate are required" },
      { status: 400 },
    );
  }

  const db = getDb(env.DB);
  const created = await createContentPost(db, {
    clientId: body.clientId,
    title: body.title.trim(),
    pillarId: body.pillarId ?? null,
    funnelStageId: body.funnelStageId ?? null,
    scheduledDate: body.scheduledDate,
    platform: body.platform ?? null,
    status: body.status ?? "idea",
    assignedTo: body.assignedTo ?? null,
    notes: body.notes ?? null,
  });
  return Response.json({ post: created }, { status: 201 });
};
