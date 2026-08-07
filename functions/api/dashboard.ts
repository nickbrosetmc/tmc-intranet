// One-shot payload for the team homepage dashboard.
//
// Deliberately returns the same shape as /api/tasks/dashboard for the task
// fields, so the dashboard can run the exact same buildItemsForUser() /
// buildPlaceholders() helpers the Tasks page uses. A dashboard that disagrees
// with the page it links to is worse than no dashboard, so there is one
// implementation of "what does this person owe" and both read it.
//
// Unlike /api/tasks/dashboard this does NOT seed blank posts. Seeding is a
// write, and the homepage is the most-hit route in the app; the placeholder
// math already covers un-seeded slots (posts + placeholders always sum to the
// client's weekly target either way), so nothing is lost by reading only.

import type { Env } from "../lib/auth";
import { isResponse, requireTeamSession } from "../lib/admin";
import { getDb, getUserByEmail } from "../db";
import { listAllTasks } from "../db/tasks";
import { listAllUsers } from "../db/admin";
import {
  listContentSettings,
  listOpenPosts,
  listPostsInRange,
} from "../db/content";
import { listRecurringClients } from "../db/finance";
import { countNewSubmissions, listAllSubmissions } from "../db/clientSubmissions";
import { countPendingShifts, listActiveShifts } from "../db/timeclock";
import { countPendingTimeOff, listApprovedInRange } from "../db/timeoff";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday of the week containing `d` (Mon-based), at 00:00:00. */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun..6=Sat
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}

function numSetting(v: string | null | undefined): number | null {
  return v != null && v !== "" ? Number(v) : null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const me = await getUserByEmail(db, session.email);
  if (!me) return Response.json({ error: "User not in DB" }, { status: 404 });
  const isAdmin = me.role === "admin";

  const today = new Date();
  const todayStr = ymd(today);

  // TMC produces a week ahead: the work in flight now is for NEXT calendar
  // week, and its deadline is this Friday. Mirrors /api/tasks/dashboard.
  const calendarWeekStart = startOfWeek(today);
  const weekStart = new Date(calendarWeekStart);
  weekStart.setDate(weekStart.getDate() + 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const friday = new Date(calendarWeekStart);
  friday.setDate(friday.getDate() + 4);

  const [
    allTasks,
    allUsers,
    openPosts,
    clients,
    settings,
    weekPosts,
    submissions,
    newSubmissionCount,
  ] = await Promise.all([
    listAllTasks(db, { includeCompleted: false, limit: 500 }),
    listAllUsers(db),
    listOpenPosts(db),
    listRecurringClients(db),
    listContentSettings(db),
    listPostsInRange(db, ymd(weekStart), ymd(weekEnd)),
    listAllSubmissions(db, { status: "new" }),
    countNewSubmissions(db),
  ]);

  // Admin-only team visibility. Kept off the payload entirely for non-admins
  // rather than hidden in the UI, so who-is-clocked-in never leaks.
  const team = isAdmin
    ? await (async () => {
        const [activeShifts, offToday, pendingTimeOff, pendingShifts] =
          await Promise.all([
            listActiveShifts(db),
            listApprovedInRange(db, todayStr, todayStr),
            countPendingTimeOff(db),
            countPendingShifts(db),
          ]);
        return {
          clockedIn: activeShifts.map((s) => ({
            userId: s.userId,
            userName: s.userName,
            jobName: s.jobName,
            startedAt: s.startedAt,
          })),
          offToday: offToday.map((r) => ({
            userId: r.userId,
            userName: r.userName,
            startDate: r.startDate,
            endDate: r.endDate,
          })),
          pendingTimeOff,
          pendingShifts,
        };
      })()
    : null;

  const weeklyPostsByClient: Record<number, number> = {};
  for (const p of weekPosts) {
    weeklyPostsByClient[p.clientId] = (weeklyPostsByClient[p.clientId] ?? 0) + 1;
  }

  return Response.json({
    // ── Same shape as /api/tasks/dashboard so the shared helpers apply ──
    user: { id: me.id, name: me.name, email: me.email },
    isAdmin,
    tasks: allTasks,
    openPosts,
    userOptions: allUsers.map((u) => ({ id: u.id, name: u.name, email: u.email })),
    clientOptions: clients.map((c) => ({
      id: c.id,
      name: c.name,
      isActive: c.isActive,
      weeklyPostTarget: c.weeklyPostTarget,
    })),
    weeklyPostsByClient,
    weekStart: ymd(weekStart),
    weekEnd: ymd(weekEnd),
    weekDueDate: ymd(friday),
    defaultPostAssigneeId: numSetting(settings.default_post_assignee_id),
    defaultPostEstimatedMinutes: numSetting(
      settings.default_post_estimated_minutes,
    ),
    // ── Dashboard-only additions ──
    /** Every post in the production week, all statuses, for the pipeline bar. */
    weekPosts,
    /** Unworked client requests and event briefs. */
    newSubmissions: submissions.slice(0, 8),
    newSubmissionCount,
    team,
  });
};
