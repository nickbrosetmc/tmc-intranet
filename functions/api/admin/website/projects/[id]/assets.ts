// Team: upload an image for a project from the team-side visual editor.
// Mirrors /api/website/assets but gated to team sessions, with the project
// taken from the URL instead of the client session.

import type { Env } from "../../../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../../../lib/admin";
import { getDb } from "../../../../../db";
import { getProjectById, recordAsset } from "../../../../../db/website";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "image";
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const db = getDb(env.DB);
  const project = await getProjectById(db, id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
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

  const key = `projects/${project.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
  await env.SITE_ASSETS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  await recordAsset(db, {
    projectId: project.id,
    r2Key: key,
    filename: safeName(file.name),
    contentType: file.type,
    sizeBytes: file.size,
    uploadedByClientUserId: null,
  });

  return Response.json({ key, url: `/api/website/assets/${key}` }, { status: 201 });
};
