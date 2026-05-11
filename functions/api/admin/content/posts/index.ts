import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { createContentPost } from "../../../../db/content";
import type { NewContentPostRow } from "../../../../db/schema";

/**
 * Once a post moves past review, pillar + funnel are required so coverage
 * analysis is meaningful. Idea/drafting/review can be untagged while the
 * team is still figuring out the angle.
 */
const COMPLETED_STATUSES = new Set(["approved", "scheduled", "posted"]);
export function requiresPillarAndFunnel(status: string | undefined): boolean {
  return COMPLETED_STATUSES.has(status ?? "");
}

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

  const status = body.status ?? "idea";
  if (requiresPillarAndFunnel(status) && (!body.pillarId || !body.funnelStageId)) {
    return Response.json(
      {
        error:
          "Pillar and funnel stage are required when a post is approved, scheduled, or posted.",
      },
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
    notes: body.notes ?? null,
  });
  return Response.json({ post: created }, { status: 201 });
};
