import type { Env } from "../../../../lib/auth";
import { isResponse, requireAdmin } from "../../../../lib/admin";
import { getDb } from "../../../../db";
import { createJob } from "../../../../db/timeclock";
import type { NewJobRow } from "../../../../db/schema";

const VALID_TYPES = new Set(["hourly", "salaried", "day_rate"]);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  let body: Partial<NewJobRow>;
  try {
    body = (await request.json()) as Partial<NewJobRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return Response.json({ error: "name required" }, { status: 400 });
  }
  if (!body.payRateType || !VALID_TYPES.has(body.payRateType)) {
    return Response.json(
      { error: "payRateType must be hourly, salaried, or day_rate" },
      { status: 400 },
    );
  }
  const rate = Number(body.payRate ?? 0);
  if (!Number.isFinite(rate) || rate < 0) {
    return Response.json(
      { error: "payRate must be a non-negative number" },
      { status: 400 },
    );
  }

  const job = await createJob(getDb(env.DB), {
    name: body.name.trim(),
    description: body.description ?? null,
    payRateType: body.payRateType,
    payRate: rate,
    isActive: body.isActive ?? true,
    sortOrder: body.sortOrder ?? 0,
  });
  return Response.json({ job }, { status: 201 });
};
