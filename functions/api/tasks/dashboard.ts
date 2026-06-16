// One-shot payload for the /tasks page.
//
// Returns:
//   tasks       — manually-created tasks
//   openPosts   — posts not yet completed; the UI shows them inline,
//                 routed to assignee or reviewer depending on status
//   weeklyPostsByClient — count of posts scheduled this Mon-Sun per
//                 client, used to compute placeholder slots
//   defaultPostAssigneeId — the user placeholders get assigned to
//   clientOptions — id + name + weekly target (drives placeholders)
//   userOptions / postOptions — pickers

import type { Env } from "../../lib/auth";
import { isResponse, requireTeamSession } from "../../lib/admin";
import { getDb, getUserByEmail } from "../../db";
import { listAllTasks } from "../../db/tasks";
import { listAllUsers } from "../../db/admin";
import {
  listContentSettings,
  listOpenPosts,
  listPostsInRange,
  seedBlankPostsForCurrentWeek,
} from "../../db/content";
import { listRecurringClients } from "../../db/finance";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `d` (Mon-based), as a Date at 00:00:00. */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
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
  const winStart = new Date(today);
  winStart.setDate(winStart.getDate() - 28);
  const winEnd = new Date(today);
  winEnd.setDate(winEnd.getDate() + 56);

  // Current Mon..Sun for the weekly-post-quota placeholder math.
  const weekStart = startOfWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // Seed any missing blank-post slots for the current week BEFORE we
  // read posts, so weeklyPostsByClient reflects the seeded rows.
  const preSeedSettings = await listContentSettings(db);
  const preSeedDefaultAssigneeRaw =
    preSeedSettings.default_post_assignee_id ?? null;
  const preSeedDefaultAssigneeId =
    preSeedDefaultAssigneeRaw != null && preSeedDefaultAssigneeRaw !== ""
      ? Number(preSeedDefaultAssigneeRaw)
      : null;
  await seedBlankPostsForCurrentWeek(db, {
    monday: weekStart,
    today,
    defaultAssigneeId: preSeedDefaultAssigneeId,
  });

  const [allTasks, allUsers, postsInWindow, openPosts, clients, settings, weekPosts] =
    await Promise.all([
      listAllTasks(db, { includeCompleted, limit: 500 }),
      listAllUsers(db),
      listPostsInRange(db, ymd(winStart), ymd(winEnd)),
      listOpenPosts(db),
      listRecurringClients(db),
      listContentSettings(db),
      listPostsInRange(db, ymd(weekStart), ymd(new Date(weekEnd.getTime() + 86_400_000))),
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
  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.name,
    isActive: c.isActive,
    weeklyPostTarget: c.weeklyPostTarget,
  }));

  // Count posts per client for the current week. We count ALL statuses
  // (even completed ones) because once a post exists it consumes a slot.
  const weeklyPostsByClient: Record<number, number> = {};
  for (const p of weekPosts) {
    weeklyPostsByClient[p.clientId] = (weeklyPostsByClient[p.clientId] ?? 0) + 1;
  }

  const defaultPostAssigneeRaw = settings.default_post_assignee_id ?? null;
  const defaultPostAssigneeId =
    defaultPostAssigneeRaw != null && defaultPostAssigneeRaw !== ""
      ? Number(defaultPostAssigneeRaw)
      : null;

  // Placeholder slots are "due by Friday" — Mon + 4 days. Used as the
  // dueDate for the virtual placeholder items so they bucket sensibly
  // (overdue if today is Sat/Sun and the slots weren't filled).
  const friday = new Date(weekStart);
  friday.setDate(friday.getDate() + 4);

  return Response.json({
    user: { id: me.id, name: me.name, email: me.email },
    tasks: allTasks,
    openPosts,
    userOptions,
    postOptions,
    clientOptions,
    weeklyPostsByClient,
    weekStart: ymd(weekStart),
    weekEnd: ymd(weekEnd),
    weekDueDate: ymd(friday),
    defaultPostAssigneeId,
  });
};
