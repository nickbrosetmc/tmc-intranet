import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import {
  deleteOneOffInvoice,
  getOneOffInvoice,
  updateOneOffInvoice,
} from "../../../../db/finance";
import type { NewOneOffInvoiceRow } from "../../../../db/schema";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  let body: Partial<NewOneOffInvoiceRow>;
  try {
    body = (await request.json()) as Partial<NewOneOffInvoiceRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only editable fields reach the database, never id or timestamps.
  const patch: Partial<NewOneOffInvoiceRow> = {};
  if (body.clientName !== undefined) {
    if (!body.clientName?.trim()) {
      return Response.json({ error: "Client name can't be empty" }, { status: 400 });
    }
    patch.clientName = body.clientName.trim();
  }
  if (body.grossAmount !== undefined) {
    if (!Number.isFinite(body.grossAmount)) {
      return Response.json({ error: "Invalid amount" }, { status: 400 });
    }
    patch.grossAmount = Math.round(body.grossAmount);
  }
  if (body.paymentMethodId !== undefined) patch.paymentMethodId = body.paymentMethodId;
  if (body.instantPayout !== undefined) patch.instantPayout = Boolean(body.instantPayout);
  if (body.notes !== undefined) patch.notes = body.notes;
  for (const key of ["invoiceDate", "payoutDate"] as const) {
    if (body[key] === undefined) continue;
    if (!DATE_RE.test(body[key] ?? "")) {
      return Response.json({ error: `Invalid ${key} (YYYY-MM-DD)` }, { status: 400 });
    }
    patch[key] = body[key]!;
  }

  const db = getDb(env.DB);
  const existing = await getOneOffInvoice(db, id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  // Check the order against the row as it will be after the edit, so changing
  // just one of the two dates can't leave them backwards.
  const invoiceDate = patch.invoiceDate ?? existing.invoiceDate;
  const payoutDate = patch.payoutDate ?? existing.payoutDate;
  if (invoiceDate && payoutDate < invoiceDate) {
    return Response.json(
      { error: "Payout date can't be before the invoice date" },
      { status: 400 },
    );
  }

  await updateOneOffInvoice(db, id, patch);
  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
  await deleteOneOffInvoice(getDb(env.DB), id);
  return Response.json({ ok: true });
};
