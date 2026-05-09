import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import {
  createOneOffInvoice,
  listOneOffInvoices,
} from "../../../../db/finance";
import type { NewOneOffInvoiceRow } from "../../../../db/schema";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  return Response.json({ invoices: await listOneOffInvoices(getDb(env.DB)) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  let body: Partial<NewOneOffInvoiceRow>;
  try {
    body = (await request.json()) as Partial<NewOneOffInvoiceRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.clientName?.trim() || !Number.isFinite(body.grossAmount) || !body.payoutDate) {
    return Response.json(
      { error: "Client name, gross amount, and payout date are required" },
      { status: 400 },
    );
  }

  const db = getDb(env.DB);
  const created = await createOneOffInvoice(db, {
    clientName: body.clientName.trim(),
    grossAmount: Math.round(body.grossAmount as number),
    paymentMethodId: body.paymentMethodId ?? null,
    payoutDate: body.payoutDate,
    instantPayout: body.instantPayout ?? false,
    notes: body.notes ?? null,
  });
  return Response.json({ invoice: created }, { status: 201 });
};
