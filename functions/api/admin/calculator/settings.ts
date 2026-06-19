import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import {
  getCalculatorSettings,
  getDb,
  getUserByEmail,
  updateCalculatorSettings,
} from "../../../db";

interface PatchBody {
  rateAdmin?: number;
  rateFt?: number;
  ratePt?: number;
  reviewTier?: "admin" | "ft" | "pt" | "none";
  reviewMins?: number;
  softwareTotal?: number;
  clientCount?: number;
  marginFloor?: number;
  billableRate?: number;
  rateDayHalf?: number;
  rateDayFull?: number;
  rateDayExtra?: number;
}

const NUMERIC_FIELDS: (keyof PatchBody)[] = [
  "rateAdmin",
  "rateFt",
  "ratePt",
  "reviewMins",
  "softwareTotal",
  "clientCount",
  "marginFloor",
  "billableRate",
  "rateDayHalf",
  "rateDayFull",
  "rateDayExtra",
];

const VALID_TIERS = new Set(["admin", "ft", "pt", "none"]);

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, number | string | null> = {};
  for (const f of NUMERIC_FIELDS) {
    if (body[f] !== undefined) {
      const v = Number(body[f]);
      if (!Number.isFinite(v) || v < 0) {
        return Response.json(
          { error: `${f} must be a non-negative number` },
          { status: 400 },
        );
      }
      updates[f] = Math.round(v);
    }
  }
  if (body.reviewTier !== undefined) {
    if (!VALID_TIERS.has(body.reviewTier)) {
      return Response.json({ error: "Invalid reviewTier" }, { status: 400 });
    }
    updates.reviewTier = body.reviewTier;
  }

  const db = getDb(env.DB);
  const editor = await getUserByEmail(db, session.email);
  updates.updatedBy = editor?.id ?? null;

  await updateCalculatorSettings(db, updates);
  const fresh = await getCalculatorSettings(db);
  return Response.json(fresh);
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Admin GET — same as user GET, but kept here so /api/admin/* stays
  // a coherent admin namespace.
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  return Response.json(await getCalculatorSettings(db));
};
