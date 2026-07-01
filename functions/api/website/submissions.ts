// Client submits a batch of edits for the team to review. The client builds
// the change list + the regenerated full-length blocks in the browser; we
// snapshot both so the review screen is reproducible later.

import type { Env } from "../../lib/auth";
import { isResponse, requireClientSession } from "../../lib/admin";
import { getDb } from "../../db";
import { getActiveProjectForClient, createSubmission } from "../../db/website";

// Guard against a runaway payload (a huge site is still only ~tens of KB).
const MAX_JSON = 2_000_000;

interface Body {
  changes?: unknown;
  blocks?: unknown;
  submittedByName?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireClientSession(request, env);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const changes = Array.isArray(body.changes) ? body.changes : null;
  const blocks = Array.isArray(body.blocks) ? body.blocks : null;
  if (!changes || !blocks || changes.length === 0 || blocks.length === 0) {
    return Response.json({ error: "No changes to submit" }, { status: 400 });
  }

  const changesJson = JSON.stringify(changes);
  const blocksJson = JSON.stringify(blocks);
  if (changesJson.length > MAX_JSON || blocksJson.length > MAX_JSON) {
    return Response.json({ error: "Submission too large" }, { status: 413 });
  }

  const db = getDb(env.DB);
  const data = await getActiveProjectForClient(db, session.clientId);
  if (!data) return Response.json({ error: "No site found" }, { status: 404 });

  const submittedByName =
    typeof body.submittedByName === "string" && body.submittedByName.trim()
      ? body.submittedByName.trim().slice(0, 120)
      : session.name;

  const submission = await createSubmission(db, {
    projectId: data.project.id,
    clientUserId: session.clientUserId,
    submittedByName,
    changesJson,
    blocksJson,
  });

  return Response.json({ submission }, { status: 201 });
};
