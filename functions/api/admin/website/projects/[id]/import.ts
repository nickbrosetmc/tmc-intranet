// Team: bulk-import a batch of uploaded files into a project. The browser
// parses each file, detects its kind (header/footer/page/block) and slug/title,
// and posts the normalized items here to be applied in one shot.

import type { Env } from "../../../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../../../lib/admin";
import { getDb } from "../../../../../db";
import { getProjectById, importItems, type ImportItem } from "../../../../../db/website";

const MAX_ITEM_HTML = 2_000_000;

function normalize(raw: unknown): ImportItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const html = typeof o.html === "string" ? o.html : "";
  if (html.length > MAX_ITEM_HTML) return null;
  switch (o.kind) {
    case "header":
      return { kind: "header", html };
    case "footer":
      return { kind: "footer", html };
    case "page": {
      const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : "Untitled";
      let slug = typeof o.slug === "string" && o.slug.trim() ? o.slug.trim() : "/" + title.toLowerCase().replace(/\s+/g, "-");
      if (!slug.startsWith("/")) slug = "/" + slug;
      return { kind: "page", title, slug, html };
    }
    case "block": {
      const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : "Content block";
      return { kind: "block", name, html };
    }
    default:
      return null;
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
  const rawItems = Array.isArray(body?.items) ? body.items : null;
  if (!rawItems || rawItems.length === 0) {
    return Response.json({ error: "No items to import" }, { status: 400 });
  }

  const items = rawItems.map(normalize).filter((x): x is ImportItem => x !== null);
  if (items.length === 0) {
    return Response.json({ error: "No valid items to import" }, { status: 400 });
  }

  const db = getDb(env.DB);
  const project = await getProjectById(db, id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const result = await importItems(db, id, items);
  return Response.json({ result }, { status: 201 });
};
