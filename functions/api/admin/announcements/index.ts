import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb, getUserByEmail } from "../../../db";
import { createAnnouncement, listAllAnnouncements } from "../../../db/admin";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const rows = await listAllAnnouncements(db);
  return Response.json({ announcements: rows });
};

interface CreateBody {
  title?: string;
  body?: string;
  isPinned?: boolean;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title?.trim() || !body.body?.trim()) {
    return Response.json(
      { error: "Title and body are both required" },
      { status: 400 },
    );
  }

  const db = getDb(env.DB);
  const author = await getUserByEmail(db, session.email);
  const created = await createAnnouncement(db, {
    title: body.title,
    body: body.body,
    createdBy: author?.id,
    isPinned: body.isPinned ?? false,
  });
  return Response.json({ announcement: created }, { status: 201 });
};
