// POST = add user to job's eligibility list
// DELETE = remove user (userId in query string)

import type { Env } from "../../../../../lib/auth";
import { isResponse, requireAdmin } from "../../../../../lib/admin";
import { getDb } from "../../../../../db";
import {
  addEligibility,
  removeEligibility,
} from "../../../../../db/timeclock";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

interface Body {
  userId?: number;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const jobId = parseId(params);
  if (!jobId) return Response.json({ error: "Invalid id" }, { status: 400 });
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.userId) return Response.json({ error: "userId required" }, { status: 400 });
  await addEligibility(getDb(env.DB), { jobId, userId: body.userId });
  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const jobId = parseId(params);
  if (!jobId) return Response.json({ error: "Invalid id" }, { status: 400 });
  const url = new URL(request.url);
  const userId = Number(url.searchParams.get("userId"));
  if (!Number.isFinite(userId) || userId <= 0) {
    return Response.json({ error: "userId query required" }, { status: 400 });
  }
  await removeEligibility(getDb(env.DB), jobId, userId);
  return Response.json({ ok: true });
};
