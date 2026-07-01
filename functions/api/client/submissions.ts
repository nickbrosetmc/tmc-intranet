// Client-facing: submit a request or event brief, and list your own.
// On create, emails the team (recipients from the client_notify_emails
// setting) via Resend — best-effort, done after the response.

import type { Env } from "../../lib/auth";
import { isResponse, requireClientSession } from "../../lib/admin";
import { getClientById, getDb } from "../../db";
import { listContentSettings } from "../../db/content";
import {
  createSubmission,
  listSubmissionsForClient,
} from "../../db/clientSubmissions";
import { esc, sendEmail } from "../../lib/email";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireClientSession(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  const rows = await listSubmissionsForClient(db, session.clientId);
  return Response.json({ submissions: rows });
};

interface CreateBody {
  type?: unknown;
  subject?: unknown;
  details?: unknown;
  eventDate?: unknown;
  location?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const session = await requireClientSession(request, env);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const type = body.type === "event" ? "event" : body.type === "request" ? "request" : null;
  if (!type) return Response.json({ error: "type must be request or event" }, { status: 400 });

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (!subject) return Response.json({ error: "Subject is required" }, { status: 400 });
  if (!details) return Response.json({ error: "Details are required" }, { status: 400 });

  let eventDate: string | null = null;
  let location: string | null = null;
  if (type === "event") {
    if (typeof body.eventDate === "string" && body.eventDate) {
      if (!DATE_RE.test(body.eventDate)) {
        return Response.json({ error: "Bad eventDate" }, { status: 400 });
      }
      eventDate = body.eventDate;
    }
    location =
      typeof body.location === "string" && body.location.trim()
        ? body.location.trim()
        : null;
  }

  const db = getDb(env.DB);
  const created = await createSubmission(db, {
    clientId: session.clientId,
    clientUserId: session.clientUserId,
    type,
    subject,
    details,
    eventDate,
    location,
    status: "new",
  });

  // Notify the team — after responding, best-effort.
  ctx.waitUntil(notifyTeam(env, db, session, { type, subject, details, eventDate, location }));

  return Response.json({ submission: created }, { status: 201 });
};

async function notifyTeam(
  env: Env,
  db: ReturnType<typeof getDb>,
  session: { clientId: number; name: string },
  s: {
    type: "request" | "event";
    subject: string;
    details: string;
    eventDate: string | null;
    location: string | null;
  },
): Promise<void> {
  try {
    const [settings, client] = await Promise.all([
      listContentSettings(db),
      getClientById(db, session.clientId),
    ]);
    const raw = settings.client_notify_emails ?? "";
    const to = raw.split(",").map((e) => e.trim()).filter(Boolean);
    if (to.length === 0) return;

    const clientName = client?.name ?? "A client";
    const label = s.type === "event" ? "event brief" : "request";
    const rows: string[] = [
      `<tr><td style="padding:4px 12px 4px 0;color:#404E5C;font-weight:600">Client</td><td>${esc(clientName)}</td></tr>`,
      `<tr><td style="padding:4px 12px 4px 0;color:#404E5C;font-weight:600">Submitted by</td><td>${esc(session.name)}</td></tr>`,
      `<tr><td style="padding:4px 12px 4px 0;color:#404E5C;font-weight:600">${s.type === "event" ? "Event" : "Subject"}</td><td>${esc(s.subject)}</td></tr>`,
    ];
    if (s.eventDate) rows.push(`<tr><td style="padding:4px 12px 4px 0;color:#404E5C;font-weight:600">Date</td><td>${esc(s.eventDate)}</td></tr>`);
    if (s.location) rows.push(`<tr><td style="padding:4px 12px 4px 0;color:#404E5C;font-weight:600">Location</td><td>${esc(s.location)}</td></tr>`);

    const html = `
      <div style="font-family:system-ui,sans-serif;color:#0E0F19;max-width:560px">
        <h2 style="color:#0E0F19;margin:0 0 4px">New client ${esc(label)}</h2>
        <p style="color:#404E5C;margin:0 0 16px">${esc(clientName)} submitted a ${esc(label)} through the portal.</p>
        <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">${rows.join("")}</table>
        <div style="background:#F1F1F0;border-radius:8px;padding:12px 14px;font-size:14px;white-space:pre-wrap">${esc(s.details)}</div>
        <p style="margin-top:16px"><a href="https://portal.tmctechhub.com/admin/requests" style="color:#A8884E;font-weight:600">View in the portal →</a></p>
      </div>`;

    await sendEmail(env, {
      to,
      subject: `New ${label} from ${clientName}: ${s.subject}`,
      html,
    });
  } catch (e) {
    console.log(JSON.stringify({ level: "error", msg: "notifyTeam.failed", error: String(e) }));
  }
}
