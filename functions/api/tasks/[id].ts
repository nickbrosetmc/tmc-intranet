// Edit or delete a task. Anyone on the team can edit/delete any task —
// 5-person team, lightweight model.

import type { Env } from "../../lib/auth";
import { isResponse, requireTeamSession } from "../../lib/admin";
import { getDb } from "../../db";
import { deleteTask, getTaskById, updateTask } from "../../db/tasks";
import type { NewTaskRow } from "../../db/schema";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];

interface PatchBody {
  title?: unknown;
  description?: unknown;
  assigneeId?: unknown;
  priority?: unknown;
  dueDate?: unknown | null;
  estimatedMinutes?: unknown | null;
  actualMinutes?: unknown | null;
  contentPostId?: unknown | null;
}

export const onRequestPatch: PagesFunction<Env> = async ({
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

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const patch: Partial<NewTaskRow> = {};

  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return Response.json({ error: "Title required" }, { status: 400 });
    patch.title = t;
  }
  if ("description" in body) {
    patch.description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
  }
  if (typeof body.assigneeId === "number" && body.assigneeId > 0) {
    patch.assigneeId = body.assigneeId;
  }
  if (typeof body.priority === "string") {
    if (!PRIORITIES.includes(body.priority as Priority)) {
      return Response.json({ error: "Bad priority" }, { status: 400 });
    }
    patch.priority = body.priority as Priority;
  }
  if ("dueDate" in body) {
    if (body.dueDate === null || body.dueDate === "") {
      patch.dueDate = null;
    } else if (typeof body.dueDate === "string" && DATE_RE.test(body.dueDate)) {
      patch.dueDate = body.dueDate;
    } else {
      return Response.json({ error: "Bad dueDate" }, { status: 400 });
    }
  }
  if ("estimatedMinutes" in body) {
    if (body.estimatedMinutes === null) {
      patch.estimatedMinutes = null;
    } else if (
      typeof body.estimatedMinutes === "number" &&
      Number.isFinite(body.estimatedMinutes) &&
      body.estimatedMinutes >= 0
    ) {
      patch.estimatedMinutes = Math.round(body.estimatedMinutes);
    } else {
      return Response.json(
        { error: "Bad estimatedMinutes" },
        { status: 400 },
      );
    }
  }
  if ("actualMinutes" in body) {
    if (body.actualMinutes === null) {
      patch.actualMinutes = null;
    } else if (
      typeof body.actualMinutes === "number" &&
      Number.isFinite(body.actualMinutes) &&
      body.actualMinutes >= 0
    ) {
      patch.actualMinutes = Math.round(body.actualMinutes);
    } else {
      return Response.json({ error: "Bad actualMinutes" }, { status: 400 });
    }
  }
  if ("contentPostId" in body) {
    if (body.contentPostId === null) {
      patch.contentPostId = null;
    } else if (
      typeof body.contentPostId === "number" &&
      body.contentPostId > 0
    ) {
      patch.contentPostId = Math.round(body.contentPostId);
    } else {
      return Response.json(
        { error: "Bad contentPostId" },
        { status: 400 },
      );
    }
  }

  await updateTask(db, id, patch);
  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb(env.DB);
  await deleteTask(db, id);
  return Response.json({ ok: true });
};
