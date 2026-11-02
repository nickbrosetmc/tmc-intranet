// Validates a client project's editable fields, for create and update.

import { PROJECT_KINDS, type NewClientProjectRow } from "../db/schema";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Fields = Partial<NewClientProjectRow>;
export type ProjectFieldsResult = { ok: true; fields: Fields } | { ok: false; error: string };

export function parseProjectFields(body: Record<string, unknown>): ProjectFieldsResult {
  const f: Fields = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const fail = (error: string): ProjectFieldsResult => ({ ok: false, error });
  const optionalText = (v: unknown, max: number): string | null | undefined =>
    v === null || v === "" ? null : typeof v === "string" ? v.trim().slice(0, max) || null : undefined;

  if (has("clientId")) {
    if (typeof body.clientId !== "number" || !Number.isInteger(body.clientId)) {
      return fail("Pick a client");
    }
    f.clientId = body.clientId;
  }
  if (has("name")) {
    if (typeof body.name !== "string" || !body.name.trim()) return fail("Name can't be empty");
    f.name = body.name.trim().slice(0, 200);
  }
  if (has("kind")) {
    const kind = PROJECT_KINDS.find((k) => k === body.kind);
    if (!kind) return fail("Unknown project type");
    f.kind = kind;
  }
  if (has("launchDate")) {
    const v = body.launchDate;
    if (v === null || v === "") f.launchDate = null;
    else if (typeof v === "string" && DATE_RE.test(v)) f.launchDate = v;
    else return fail("Invalid launch date");
  }
  if (has("price")) {
    const v = body.price;
    if (v === null || v === "") f.price = null;
    else if (typeof v === "number" && Number.isFinite(v) && v >= 0) f.price = Math.round(v);
    else return fail("Invalid price");
  }
  if (has("url")) {
    const v = optionalText(body.url, 500);
    if (v === undefined) return fail("Invalid URL");
    f.url = v;
  }
  if (has("notes")) {
    const v = optionalText(body.notes, 2000);
    if (v === undefined) return fail("Invalid notes");
    f.notes = v;
  }
  return { ok: true, fields: f };
}
