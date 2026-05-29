// User: cancel one of their own pending requests, or edit it before
// a decision is made. Once approved/denied, only an admin can touch it.

import type { Env } from "../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../lib/admin";
import { getDb, getUserByEmail } from "../../../db";
import {
  getTimeOffById,
  updateTimeOff,
} from "../../../db/timeoff";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface PatchBody {
  startDate?: unknown;
  endDate?: unknown;
  coveragePlan?: unknown;
  reason?: unknown;
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
  const me = await getUserByEmail(db, session.email);
  if (!me) return Response.json({ error: "User not in DB" }, { status: 404 });

  const row = await getTimeOffById(db, id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.userId !== me.id) {
    return Response.json({ error: "Not yours" }, { status: 403 });
  }
  if (row.status !== "pending") {
    return Response.json(
      { error: "Only pending requests can be edited" },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const patch: Parameters<typeof updateTimeOff>[2] = {};
  if (typeof body.startDate === "string") {
    if (!DATE_RE.test(body.startDate)) {
      return Response.json({ error: "Bad startDate" }, { status: 400 });
    }
    patch.startDate = body.startDate;
  }
  if (typeof body.endDate === "string") {
    if (!DATE_RE.test(body.endDate)) {
      return Response.json({ error: "Bad endDate" }, { status: 400 });
    }
    patch.endDate = body.endDate;
  }
  if (typeof body.coveragePlan === "string") {
    const cov = body.coveragePlan.trim();
    if (!cov) {
      return Response.json(
        { error: "Coverage plan required" },
        { status: 400 },
      );
    }
    patch.coveragePlan = cov;
  }
  if ("reason" in body) {
    patch.reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : null;
  }

  const finalStart = patch.startDate ?? row.startDate;
  const finalEnd = patch.endDate ?? row.endDate;
  if (finalEnd < finalStart) {
    return Response.json(
      { error: "endDate must be on or after startDate" },
      { status: 400 },
    );
  }

  await updateTimeOff(db, id, patch);
  return Response.json({ ok: true });
};

/** User-initiated cancel — soft-status update so audit trail stays. */
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
  const me = await getUserByEmail(db, session.email);
  if (!me) return Response.json({ error: "User not in DB" }, { status: 404 });

  const row = await getTimeOffById(db, id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.userId !== me.id) {
    return Response.json({ error: "Not yours" }, { status: 403 });
  }
  if (row.status !== "pending" && row.status !== "approved") {
    return Response.json(
      { error: `Cannot cancel a ${row.status} request` },
      { status: 409 },
    );
  }

  await updateTimeOff(db, id, { status: "cancelled" });
  return Response.json({ ok: true });
};
