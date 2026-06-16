// One-shot payload for the /tasks page. Everyone on the team sees every
// task — small team, no need to gate.

import type { Env } from "../../lib/auth";
import { isResponse, requireTeamSession } from "../../lib/admin";
import { getDb, getUserByEmail } from "../../db";
import { listAllTasks } from "../../db/tasks";
import { listAllUsers } from "../../db/admin";
import { listPostsInRange } from "../../db/content";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const me = await getUserByEmail(db, session.email);
  if (!me) return Response.json({ error: "User not in DB" }, { status: 404 });

  const url = new URL(request.url);
  const includeCompleted = url.searchParams.get("includeCompleted") === "1";

  // 4 weeks back, 8 weeks forward — covers everything anyone would
  // sensibly link a task to without blowing up the picker.
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 28);
  const end = new Date(today);
  end.setDate(end.getDate() + 56);

  const [allTasks, allUsers, posts] = await Promise.all([
    listAllTasks(db, { includeCompleted, limit: 500 }),
    listAllUsers(db),
    listPostsInRange(db, ymd(start), ymd(end)),
  ]);

  const userOptions = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
  }));
  const postOptions = posts.map((p) => ({
    id: p.id,
    title: p.title,
    scheduledDate: p.scheduledDate,
    clientId: p.clientId,
  }));

  return Response.json({
    user: { id: me.id, name: me.name, email: me.email },
    tasks: allTasks,
    userOptions,
    postOptions,
  });
};
