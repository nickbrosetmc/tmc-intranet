// Admin: edit a time-off request (correct dates, swap coverage plan,
// etc.) or hard-delete an obvious mistake.

import type { Env } from "../../../lib/auth";
import { isResponse, requireAdmin } from "../../../lib/admin";
import { getDb } from "../../../db";
import {
  deleteTimeOff,
  getTimeOffById,
  updateTimeOff,
} from "../../../db/timeoff";
import type { NewTimeOffRequestRow } from "../../../db/schema";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["pending", "approved", "denied", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

interface PatchBody {
  startDate?: unknown;
  endDate?: unknown;
  coveragePlan?: unknown;
  reason?: unknown;
  status?: unknown;
  adminNote?: unknown;
}

export const onRequestPatch: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb(env.DB);
  const row = await getTimeOffById(db, id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const patch: Partial<NewTimeOffRequestRow> = {};
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
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status as Status)) {
      return Response.json({ error: "Bad status" }, { status: 400 });
    }
    patch.status = body.status as Status;
  }
  if ("adminNote" in body) {
    patch.adminNote =
      typeof body.adminNote === "string" && body.adminNote.trim()
        ? body.adminNote.trim()
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

export const onRequestDelete: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb(env.DB);
  await deleteTimeOff(db, id);
  return Response.json({ ok: true });
};
