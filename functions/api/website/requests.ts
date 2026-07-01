// Client "request a change" — free text plus an optional already-uploaded
// asset (see assets.ts). For anything outside their editable zones.

import type { Env } from "../../lib/auth";
import { isResponse, requireClientSession } from "../../lib/admin";
import { getDb } from "../../db";
import { getActiveProjectForClient, createRequest } from "../../db/website";

interface Body {
  body?: unknown;
  assetKey?: unknown;
  assetName?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireClientSession(request, env);
  if (isResponse(session)) return session;

  const payload = (await request.json().catch(() => null)) as Body | null;
  if (!payload) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const text = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!text) return Response.json({ error: "Description is required" }, { status: 400 });

  const db = getDb(env.DB);
  const data = await getActiveProjectForClient(db, session.clientId);
  if (!data) return Response.json({ error: "No site found" }, { status: 404 });

  // Only accept an asset key that belongs to this client's project.
  let assetKey: string | null = null;
  let assetName: string | null = null;
  if (typeof payload.assetKey === "string" && payload.assetKey.startsWith(`projects/${data.project.id}/`)) {
    assetKey = payload.assetKey;
    assetName = typeof payload.assetName === "string" ? payload.assetName.slice(0, 200) : null;
  }

  const reqRow = await createRequest(db, {
    projectId: data.project.id,
    clientUserId: session.clientUserId,
    submittedByName: session.name,
    body: text.slice(0, 4000),
    assetKey,
    assetName,
  });

  return Response.json({ request: reqRow }, { status: 201 });
};
