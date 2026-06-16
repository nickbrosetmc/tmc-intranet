// Team-accessible content post creation. Pillar + funnel are still
// required at "completed" status (see requiresPillarAndFunnel).

import type { Env } from "../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../lib/admin";
import { getDb } from "../../../db";
import { createContentPost } from "../../../db/content";
import type { NewContentPostRow } from "../../../db/schema";
import { requiresPillarAndFunnel } from "../../admin/content/posts/index";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
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

  const status = body.status ?? "idea";
  if (requiresPillarAndFunnel(status) && (!body.pillarId || !body.funnelStageId)) {
    return Response.json(
      { error: "Pillar and funnel stage are required to mark a post completed." },
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
    status,
    assignedTo: body.assignedTo ?? null,
    reviewerId: body.reviewerId ?? null,
    estimatedMinutes: body.estimatedMinutes ?? null,
    notes: body.notes ?? null,
  });
  return Response.json({ post: created }, { status: 201 });
};
