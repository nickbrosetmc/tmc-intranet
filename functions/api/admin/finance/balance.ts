import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb, getUserByEmail } from "../../../db";
import { getFinanceSettings, updateFinanceSettings } from "../../../db/finance";

interface PatchBody {
  currentBalance?: number;
  notes?: string | null;
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: { currentBalance?: number; notes?: string | null; updatedBy?: number } = {};
  if (body.currentBalance !== undefined) {
    const v = Number(body.currentBalance);
    if (!Number.isFinite(v)) {
      return Response.json({ error: "currentBalance must be a number" }, { status: 400 });
    }
    updates.currentBalance = Math.round(v);
  }
  if (body.notes !== undefined) updates.notes = body.notes;

  const db = getDb(env.DB);
  const editor = await getUserByEmail(db, session.email);
  if (editor) updates.updatedBy = editor.id;

  await updateFinanceSettings(db, updates);
  return Response.json(await getFinanceSettings(db));
};
