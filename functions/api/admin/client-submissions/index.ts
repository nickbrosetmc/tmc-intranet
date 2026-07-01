// Admin inbox: all client requests + event briefs, plus the current
// notification recipient list (editable via /api/admin/content/settings).

import type { Env } from "../../../lib/auth";
import { isResponse, requireAdmin } from "../../../lib/admin";
import { getDb } from "../../../db";
import { listContentSettings } from "../../../db/content";
import { listAllSubmissions } from "../../../db/clientSubmissions";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const [submissions, settings] = await Promise.all([
    listAllSubmissions(db),
    listContentSettings(db),
  ]);

  return Response.json({
    submissions,
    notifyEmails: settings.client_notify_emails ?? "",
  });
};
