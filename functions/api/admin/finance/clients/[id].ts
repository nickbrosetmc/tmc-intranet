import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import {
  deleteRecurringClient,
  getRecurringClient,
  updateRecurringClient,
} from "../../../../db/finance";
import { datesInOrder, parseClientFields } from "../../../../lib/clientFields";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseClientFields(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const db = getDb(env.DB);
  const existing = await getRecurringClient(db, id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  // Editing one date alone mustn't leave the pair backwards.
  const signed = parsed.fields.signedDate !== undefined ? parsed.fields.signedDate : existing.signedDate;
  const ended = parsed.fields.endedDate !== undefined ? parsed.fields.endedDate : existing.endedDate;
  if (!datesInOrder(signed, ended)) {
    return Response.json({ error: "The end date can't be before the signed date" }, { status: 400 });
  }

  await updateRecurringClient(db, id, parsed.fields);
  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
  const db = getDb(env.DB);
  const result = await deleteRecurringClient(db, id);
  if (!result.ok) {
    // 409, not 500: the request is understood, the client just still has
    // content hanging off it.
    return Response.json(
      {
        error:
          `This client has ${result.posts} content ${
            result.posts === 1 ? "post" : "posts"
          } in the planner. Mark it inactive instead, or remove its posts first.`,
      },
      { status: 409 },
    );
  }
  return Response.json({ ok: true });
};
