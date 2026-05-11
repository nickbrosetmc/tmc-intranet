import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import {
  deleteContentPost,
  getContentPostById,
  updateContentPost,
} from "../../../../db/content";
import type { NewContentPostRow } from "../../../../db/schema";
import { requiresPillarAndFunnel } from "./index";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
  let body: Partial<NewContentPostRow>;
  try {
    body = (await request.json()) as Partial<NewContentPostRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = getDb(env.DB);

  // Compute the merged state to validate against — patch may contain only
  // some fields, so we need to know what the post will look like AFTER.
  const existing = await getContentPostById(db, id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const merged = {
    status: body.status ?? existing.status,
    pillarId: body.pillarId !== undefined ? body.pillarId : existing.pillarId,
    funnelStageId:
      body.funnelStageId !== undefined ? body.funnelStageId : existing.funnelStageId,
  };

  if (
    requiresPillarAndFunnel(merged.status) &&
    (merged.pillarId == null || merged.funnelStageId == null)
  ) {
    return Response.json(
      {
        error:
          "Pillar and funnel stage are required when a post is approved, scheduled, or posted.",
      },
      { status: 400 },
    );
  }

  await updateContentPost(db, id, body);
  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
  await deleteContentPost(getDb(env.DB), id);
  return Response.json({ ok: true });
};
