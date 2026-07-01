// Serves an uploaded image back from R2. Keys are unguessable (UUID-prefixed)
// and the content is public site imagery, so no auth gate here — same as any
// image on the live site. Catch-all because R2 keys contain slashes.

import type { Env } from "../../../lib/auth";

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const raw = params.key;
  const key = Array.isArray(raw) ? raw.join("/") : String(raw ?? "");
  if (!key.startsWith("projects/")) {
    return new Response("Not found", { status: 404 });
  }

  const obj = await env.SITE_ASSETS.get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
};
