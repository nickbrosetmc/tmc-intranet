// Validates the editable fields of a finance (recurring) client, for both
// create and update. Only the fields listed here reach the database, so a
// request can't set ids or timestamps, and each one is checked for shape.

import type { NewRecurringClientRow } from "../db/schema";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TERMS = [0, 6, 12];

type Fields = Partial<NewRecurringClientRow>;
export type FieldsResult = { ok: true; fields: Fields } | { ok: false; error: string };

export function parseClientFields(body: Record<string, unknown>): FieldsResult {
  const f: Fields = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const fail = (error: string): FieldsResult => ({ ok: false, error });

  if (has("name")) {
    if (typeof body.name !== "string" || !body.name.trim()) return fail("Name can't be empty");
    f.name = body.name.trim();
  }
  if (has("monthlyAmount")) {
    if (typeof body.monthlyAmount !== "number" || !Number.isFinite(body.monthlyAmount)) {
      return fail("Invalid monthly amount");
    }
    f.monthlyAmount = Math.round(body.monthlyAmount);
  }
  if (has("paymentMethodId")) {
    if (body.paymentMethodId !== null && typeof body.paymentMethodId !== "number") {
      return fail("Invalid payment method");
    }
    f.paymentMethodId = body.paymentMethodId as number | null;
  }
  if (has("invoiceDay")) {
    const v = body.invoiceDay;
    if (v !== null && (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 31)) {
      return fail("Invoice day must be 1 to 31");
    }
    f.invoiceDay = v as number | null;
  }
  if (has("isActive")) f.isActive = Boolean(body.isActive);
  if (has("notes")) {
    if (body.notes !== null && typeof body.notes !== "string") return fail("Invalid notes");
    f.notes = (body.notes as string | null) || null;
  }
  if (has("sortOrder")) {
    if (typeof body.sortOrder !== "number" || !Number.isInteger(body.sortOrder)) {
      return fail("Invalid sort order");
    }
    f.sortOrder = body.sortOrder;
  }
  if (has("weeklyPostTarget")) {
    const v = body.weeklyPostTarget;
    if (v !== null && (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 7)) {
      return fail("Posts per week must be 0 to 7");
    }
    f.weeklyPostTarget = v as number | null;
  }
  if (has("postingDays")) {
    if (body.postingDays !== null && typeof body.postingDays !== "string") {
      return fail("Invalid posting days");
    }
    f.postingDays = (body.postingDays as string | null) || null;
  }

  // Client lifetime
  for (const key of ["signedDate", "endedDate"] as const) {
    if (!has(key)) continue;
    const v = body[key];
    if (v === null || v === "") {
      f[key] = null;
    } else if (typeof v === "string" && DATE_RE.test(v)) {
      f[key] = v;
    } else {
      return fail(`Invalid ${key === "signedDate" ? "signed" : "end"} date`);
    }
  }
  if (has("termMonths")) {
    const v = body.termMonths;
    if (v !== null && !TERMS.includes(v as number)) {
      return fail("Term must be 6 or 12 months, or month-to-month");
    }
    f.termMonths = v as number | null;
  }
  if (has("ltvAdjustment")) {
    const v = body.ltvAdjustment;
    if (v !== null && (typeof v !== "number" || !Number.isFinite(v))) {
      return fail("Invalid LTV adjustment");
    }
    f.ltvAdjustment = v === null || v === 0 ? null : Math.round(v as number);
  }

  return { ok: true, fields: f };
}

/** A client can't leave before they signed. Checked against the row as it will be saved. */
export function datesInOrder(signed: string | null | undefined, ended: string | null | undefined): boolean {
  return !signed || !ended || ended >= signed;
}
