// Mark a task complete. If the timer was running, computes the elapsed
// minutes and stores them in actual_minutes — but the body can override
// (the complete dialog lets the user edit before submitting so a "ran
// over lunch" timer doesn't get committed verbatim).

import type { Env } from "../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../lib/admin";
import { getDb } from "../../../db";
import { getTaskById, updateTask } from "../../../db/tasks";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

interface CompleteBody {
  actualMinutes?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb(env.DB);
  const row = await getTaskById(db, id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.status === "completed") {
    return Response.json({ error: "Already completed" }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as CompleteBody;

  let actualMinutes: number | null = row.actualMinutes;
  if (
    typeof body.actualMinutes === "number" &&
    Number.isFinite(body.actualMinutes) &&
    body.actualMinutes >= 0
  ) {
    actualMinutes = Math.round(body.actualMinutes);
  } else if (row.startedAt) {
    // Auto-compute from the timer if no manual value was provided.
    const ms = Date.now() - new Date(row.startedAt).getTime();
    actualMinutes = Math.max(0, Math.round(ms / 60_000));
  }

  await updateTask(db, id, {
    status: "completed",
    completedAt: new Date().toISOString(),
    actualMinutes,
  });
  return Response.json({ ok: true });
};
