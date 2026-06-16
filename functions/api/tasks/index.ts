// Create a new task. Any team member can create; assignee defaults to
// the creator if not specified.

import type { Env } from "../../lib/auth";
import { isResponse, requireTeamSession } from "../../lib/admin";
import { getDb, getUserByEmail } from "../../db";
import { createTask } from "../../db/tasks";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];

interface CreateBody {
  title?: unknown;
  description?: unknown;
  assigneeId?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  estimatedMinutes?: unknown;
  contentPostId?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;

  const priority =
    typeof body.priority === "string" &&
    PRIORITIES.includes(body.priority as Priority)
      ? (body.priority as Priority)
      : "medium";

  let dueDate: string | null = null;
  if (typeof body.dueDate === "string" && body.dueDate) {
    if (!DATE_RE.test(body.dueDate)) {
      return Response.json({ error: "Bad dueDate" }, { status: 400 });
    }
    dueDate = body.dueDate;
  }

  let estimatedMinutes: number | null = null;
  if (typeof body.estimatedMinutes === "number") {
    if (!Number.isFinite(body.estimatedMinutes) || body.estimatedMinutes < 0) {
      return Response.json(
        { error: "estimatedMinutes must be a non-negative number" },
        { status: 400 },
      );
    }
    estimatedMinutes = Math.round(body.estimatedMinutes);
  }

  let contentPostId: number | null = null;
  if (typeof body.contentPostId === "number" && body.contentPostId > 0) {
    contentPostId = Math.round(body.contentPostId);
  }

  const db = getDb(env.DB);
  const me = await getUserByEmail(db, session.email);
  if (!me) return Response.json({ error: "User not in DB" }, { status: 404 });

  const assigneeId =
    typeof body.assigneeId === "number" && body.assigneeId > 0
      ? body.assigneeId
      : me.id;

  const task = await createTask(db, {
    title,
    description,
    assigneeId,
    createdBy: me.id,
    priority,
    dueDate,
    estimatedMinutes,
    contentPostId,
    status: "pending",
  });

  return Response.json({ task }, { status: 201 });
};
