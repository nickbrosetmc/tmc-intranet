// Team-accessible content dashboard payload. Same shape as the admin
// endpoint (/api/admin/content) but gated to any signed-in team user
// so the whole team can use the tracker. Settings mutations stay
// admin-only at /api/admin/content/*.

import type { Env } from "../../lib/auth";
import { isResponse, requireTeamSession } from "../../lib/admin";
import { getDb } from "../../db";
import {
  listContentSettings,
  listFunnelStages,
  listPillars,
  listPostsInRange,
  seedBlankPostsForCurrentWeek,
} from "../../db/content";
import { listRecurringClients } from "../../db/finance";
import { listAllUsers } from "../../db/admin";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end) {
    return Response.json(
      { error: "start and end (YYYY-MM-DD) query params required" },
      { status: 400 },
    );
  }

  const db = getDb(env.DB);

  // Seed blank slots for the PRODUCTION week (next calendar week) — TMC
  // produces a week ahead, so the slots that should auto-fill are next
  // week's, not this week's. Cheap no-op when nothing's missing.
  const today = new Date();
  const calendarMonday = new Date(today);
  calendarMonday.setHours(0, 0, 0, 0);
  const dayIdx = calendarMonday.getDay();
  calendarMonday.setDate(calendarMonday.getDate() + (dayIdx === 0 ? -6 : 1 - dayIdx));
  const monday = new Date(calendarMonday);
  monday.setDate(monday.getDate() + 7);
  const seedSettings = await listContentSettings(db);
  const seedDefaultAssigneeRaw = seedSettings.default_post_assignee_id ?? null;
  const seedDefaultAssigneeId =
    seedDefaultAssigneeRaw != null && seedDefaultAssigneeRaw !== ""
      ? Number(seedDefaultAssigneeRaw)
      : null;
  const seedDefaultEstRaw = seedSettings.default_post_estimated_minutes ?? null;
  const seedDefaultEstMinutes =
    seedDefaultEstRaw != null && seedDefaultEstRaw !== ""
      ? Number(seedDefaultEstRaw)
      : null;
  await seedBlankPostsForCurrentWeek(db, {
    monday,
    today,
    defaultAssigneeId: seedDefaultAssigneeId,
    defaultEstimatedMinutes: seedDefaultEstMinutes,
  });

  const [pillars, funnelStages, clients, posts, settings, allUsers] =
    await Promise.all([
      listPillars(db),
      listFunnelStages(db),
      listRecurringClients(db),
      listPostsInRange(db, start, end),
      listContentSettings(db),
      listAllUsers(db),
    ]);

  const userOptions = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
  }));

  return Response.json({
    pillars,
    funnelStages,
    clients,
    posts,
    settings,
    userOptions,
    range: { start, end },
  });
};
