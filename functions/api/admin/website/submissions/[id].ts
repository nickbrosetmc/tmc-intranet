// Team: read one submission (parsed changes + regenerated blocks for the
// review screen), update the per-block "done" checkboxes, and publish or
// dismiss it.

import type { Env } from "../../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../../lib/admin";
import { getDb, getUserByEmail } from "../../../../db";
import {
  getSubmissionById,
  setSubmissionDone,
  publishSubmission,
  dismissSubmission,
} from "../../../../db/website";

function subId(params: Record<string, string | string[]>): number {
  return Number(Array.isArray(params.id) ? params.id[0] : params.id);
}

function parsed(row: NonNullable<Awaited<ReturnType<typeof getSubmissionById>>>) {
  const safe = (s: string, fb: unknown) => {
    try {
      return JSON.parse(s);
    } catch {
      return fb;
    }
  };
  return {
    ...row,
    changes: safe(row.changesJson, []),
    blocks: safe(row.blocksJson, []),
    done: safe(row.doneJson, []),
  };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  const row = await getSubmissionById(db, subId(params));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ submission: parsed(row) });
};

interface PatchBody {
  done?: unknown;
  action?: unknown;
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const db = getDb(env.DB);
  const id = subId(params);
  const row = await getSubmissionById(db, id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  if (Array.isArray(body.done)) {
    await setSubmissionDone(db, id, JSON.stringify(body.done.filter((x) => typeof x === "string")));
  }

  if (body.action === "publish") {
    const me = await getUserByEmail(db, session.email);
    await publishSubmission(db, id, me?.id ?? 0);
  } else if (body.action === "dismiss") {
    await dismissSubmission(db, id);
  }

  const updated = await getSubmissionById(db, id);
  return Response.json({ submission: updated ? parsed(updated) : null });
};
