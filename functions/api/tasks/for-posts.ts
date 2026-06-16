// Lookup helper: given a list of content_post ids (?postIds=1,2,3), return
// the tasks linked to those posts. The content tracker calls this so it
// can show a "2 tasks" badge per cell without dragging in the entire
// tasks table.

import type { Env } from "../../lib/auth";
import { isResponse, requireTeamSession } from "../../lib/admin";
import { getDb } from "../../db";
import { listTasksForContentPosts } from "../../db/tasks";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const url = new URL(request.url);
  const raw = url.searchParams.get("postIds") ?? "";
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) return Response.json({ tasks: [] });

  const db = getDb(env.DB);
  const tasks = await listTasksForContentPosts(db, ids);
  return Response.json({ tasks });
};
