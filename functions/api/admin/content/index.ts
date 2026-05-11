// Single endpoint that returns everything the content dashboard needs
// for a given date range. Client and "things that change rarely"
// (pillars, funnel stages) come along for the ride so the page can
// fetch once and re-render on its own.

import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import {
  listFunnelStages,
  listPillars,
  listPostsInRange,
} from "../../../db/content";
import { listRecurringClients } from "../../../db/finance";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const url = new URL(request.url);
  const start = url.searchParams.get("start"); // YYYY-MM-DD inclusive
  const end = url.searchParams.get("end"); // YYYY-MM-DD exclusive
  if (!start || !end) {
    return Response.json(
      { error: "start and end query params required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const db = getDb(env.DB);
  const [pillars, funnelStages, clients, posts] = await Promise.all([
    listPillars(db),
    listFunnelStages(db),
    listRecurringClients(db),
    listPostsInRange(db, start, end),
  ]);

  return Response.json({
    pillars,
    funnelStages,
    clients,
    posts,
    range: { start, end },
  });
};
