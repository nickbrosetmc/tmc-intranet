import { getAppById, getDb, getUserByEmail, recordLaunch } from "../../../db";
import type { Env } from "../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../lib/admin";

interface LaunchBody {
  type?: "desktop" | "web";
}

export const onRequestPost: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const idStr = Array.isArray(params.id) ? params.id[0] : params.id;
  const appId = Number(idStr);
  if (!Number.isFinite(appId) || appId <= 0) {
    return Response.json({ error: "Invalid app id" }, { status: 400 });
  }

  let body: LaunchBody = {};
  try {
    body = (await request.json()) as LaunchBody;
  } catch {
    // empty body is fine — we'll default to "web"
  }
  const launchType = body.type === "desktop" ? "desktop" : "web";

  const db = getDb(env.DB);
  const app = await getAppById(db, appId);
  if (!app) {
    return Response.json({ error: "App not found" }, { status: 404 });
  }

  const user = await getUserByEmail(db, session.email);
  if (!user) {
    return Response.json({ error: "User not in database" }, { status: 403 });
  }

  await recordLaunch(db, user.id, app.id, launchType);

  return Response.json({ ok: true });
};
