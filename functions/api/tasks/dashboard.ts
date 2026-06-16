// One-shot payload for the /tasks page. Everyone on the team sees every
// task — small team, no need to gate.
//
// Returns:
//   tasks       — manually created tasks (from the tasks table)
//   openPosts   — content posts not yet completed; the /tasks UI renders
//                 them inline, with effective assignee = reviewer when
//                 status='review' else assignedTo, so a post in review
//                 lands on the reviewer's list.
//   postOptions — the picker for linking a manual task to a post (narrow
//                 -28d/+56d window so the dropdown stays sane).
//   clients     — needed so post-rows can show the client name.

import type { Env } from "../../lib/auth";
import { isResponse, requireTeamSession } from "../../lib/admin";
import { getDb, getUserByEmail } from "../../db";
import { listAllTasks } from "../../db/tasks";
import { listAllUsers } from "../../db/admin";
import { listOpenPosts, listPostsInRange } from "../../db/content";
import { listRecurringClients } from "../../db/finance";

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

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 28);
  const end = new Date(today);
  end.setDate(end.getDate() + 56);

  const [allTasks, allUsers, postsInWindow, openPosts, clients] =
    await Promise.all([
      listAllTasks(db, { includeCompleted, limit: 500 }),
      listAllUsers(db),
      listPostsInRange(db, ymd(start), ymd(end)),
      listOpenPosts(db),
      listRecurringClients(db),
    ]);

  const userOptions = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
  }));
  const postOptions = postsInWindow.map((p) => ({
    id: p.id,
    title: p.title,
    scheduledDate: p.scheduledDate,
    clientId: p.clientId,
  }));
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));

  return Response.json({
    user: { id: me.id, name: me.name, email: me.email },
    tasks: allTasks,
    openPosts,
    userOptions,
    postOptions,
    clientOptions,
  });
};
