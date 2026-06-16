// Start the opt-in timer for a task. Sets status='in_progress' and
// stamps started_at. Re-starting an already-running task just resets the
// start time (use case: timer ran over lunch, click Start again to drop
// the inflated elapsed and resume from now).

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
  if (row.status === "completed" || row.status === "cancelled") {
    return Response.json(
      { error: `Cannot start a ${row.status} task — reopen it first.` },
      { status: 409 },
    );
  }

  await updateTask(db, id, {
    status: "in_progress",
    startedAt: new Date().toISOString(),
  });
  return Response.json({ ok: true });
};
