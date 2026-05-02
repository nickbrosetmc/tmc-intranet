import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import { createApp, listAllApps } from "../../../db/admin";
import type { NewAppRow } from "../../../db/schema";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const rows = await listAllApps(db);
  return Response.json({ apps: rows });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  let body: Partial<NewAppRow>;
  try {
    body = (await request.json()) as Partial<NewAppRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string") {
    return Response.json({ error: "Name required" }, { status: 400 });
  }
  if (!body.webUrl && !body.desktopProtocol) {
    return Response.json(
      { error: "At least one of webUrl or desktopProtocol required" },
      { status: 400 },
    );
  }

  const db = getDb(env.DB);
  const created = await createApp(db, {
    name: body.name,
    description: body.description ?? null,
    iconUrl: body.iconUrl ?? null,
    iconEmoji: body.iconEmoji ?? null,
    iconBgColor: body.iconBgColor ?? null,
    desktopProtocol: body.desktopProtocol ?? null,
    webUrl: body.webUrl ?? null,
    groupId: body.groupId ?? null,
    sortOrder: body.sortOrder ?? 0,
    isComingSoon: body.isComingSoon ?? false,
    isActive: body.isActive ?? true,
  });

  return Response.json({ app: created }, { status: 201 });
};
