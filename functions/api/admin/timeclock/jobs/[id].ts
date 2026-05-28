import type { Env } from "../../../../lib/auth";
import { isResponse, requireAdmin } from "../../../../lib/admin";
import { getDb } from "../../../../db";
import { deleteJob, updateJob } from "../../../../db/timeclock";
import type { NewJobRow } from "../../../../db/schema";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

const VALID_TYPES = new Set(["hourly", "salaried", "day_rate"]);

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  let body: Partial<NewJobRow>;
  try {
    body = (await request.json()) as Partial<NewJobRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.payRateType !== undefined && !VALID_TYPES.has(body.payRateType)) {
    return Response.json(
      { error: "payRateType must be hourly, salaried, or day_rate" },
      { status: 400 },
    );
  }
  if (body.payRate !== undefined) {
    const r = Number(body.payRate);
    if (!Number.isFinite(r) || r < 0) {
      return Response.json({ error: "payRate invalid" }, { status: 400 });
    }
    body.payRate = r;
  }

  await updateJob(getDb(env.DB), id, body);
  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
  await deleteJob(getDb(env.DB), id);
  return Response.json({ ok: true });
};
