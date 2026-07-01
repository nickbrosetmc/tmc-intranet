// Admin: update a client submission's status / notes.

import type { Env } from "../../../lib/auth";
import { isResponse, requireAdmin } from "../../../lib/admin";
import { getDb } from "../../../db";
import {
  getSubmissionById,
  updateSubmission,
} from "../../../db/clientSubmissions";
import type { NewClientSubmissionRow } from "../../../db/schema";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

const STATUSES = ["new", "in_progress", "done"] as const;

interface PatchBody {
  status?: unknown;
  adminNotes?: unknown;
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb(env.DB);
  const row = await getSubmissionById(db, id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const patch: Partial<NewClientSubmissionRow> = {};
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) {
      return Response.json({ error: "Bad status" }, { status: 400 });
    }
    patch.status = body.status as (typeof STATUSES)[number];
  }
  if ("adminNotes" in body) {
    patch.adminNotes =
      typeof body.adminNotes === "string" && body.adminNotes.trim()
        ? body.adminNotes.trim()
        : null;
  }

  await updateSubmission(db, id, patch);
  return Response.json({ ok: true });
};
