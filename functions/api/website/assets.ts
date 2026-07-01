// Image upload from the editor (hero swaps, request attachments). Stores the
// file in R2 under the client's project prefix and returns a key + a URL that
// serves it back through assets/[[key]].ts.

import type { Env } from "../../lib/auth";
import { isResponse, requireClientSession } from "../../lib/admin";
import { getDb } from "../../db";
import { getActiveProjectForClient, recordAsset } from "../../db/website";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "image";
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireClientSession(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const data = await getActiveProjectForClient(db, session.clientId);
  if (!data) return Response.json({ error: "No site found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  // Runtime returns a File for an uploaded field; annotate so it narrows
  // regardless of how the FormData lib types the entry union.
  const file = form?.get("file") as File | string | null;
  if (!file || typeof file === "string") {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return Response.json({ error: "Unsupported image type" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Image too large (max 8 MB)" }, { status: 413 });
  }

  const key = `projects/${data.project.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
  await env.SITE_ASSETS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  await recordAsset(db, {
    projectId: data.project.id,
    r2Key: key,
    filename: safeName(file.name),
    contentType: file.type,
    sizeBytes: file.size,
    uploadedByClientUserId: session.clientUserId,
  });

  return Response.json({ key, url: `/api/website/assets/${key}` }, { status: 201 });
};
