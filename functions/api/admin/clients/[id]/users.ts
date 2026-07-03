import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getClientById, getClientUserByUsername, getDb } from "../../../../db";
import {
  addClientMembership,
  createClientUser,
  listClientUsers,
} from "../../../../db/admin";
import { hashPassword } from "../../../../lib/passwords";
import { esc, sendEmail } from "../../../../lib/email";

function parseClientId(
  params: Record<string, string | string[]>,
): number | null {
  const raw = params.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export const onRequestGet: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const clientId = parseClientId(params);
  if (!clientId) return Response.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb(env.DB);
  const rows = await listClientUsers(db, clientId);
  // Strip password hash before returning
  const safe = rows.map(({ passwordHash: _ph, ...rest }) => rest);
  return Response.json({ users: safe });
};

interface CreateBody {
  // Create a brand-new user…
  username?: string;
  password?: string;
  name?: string;
  email?: string;
  // …or attach an existing user (by username) to this client.
  attachUsername?: string;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env, params } = ctx;
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const clientId = parseClientId(params);
  if (!clientId) return Response.json({ error: "Invalid id" }, { status: 400 });

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = getDb(env.DB);
  const client = await getClientById(db, clientId);
  if (!client) {
    return Response.json({ error: "Client not found" }, { status: 404 });
  }

  // ── Attach an existing user to this client ──
  if (body.attachUsername) {
    const uname = body.attachUsername.trim().toLowerCase();
    const existing = await getClientUserByUsername(db, uname);
    if (!existing) {
      return Response.json(
        { error: `No client user with username "${uname}"` },
        { status: 404 },
      );
    }
    await addClientMembership(db, existing.id, clientId);

    if (existing.email) {
      ctx.waitUntil(
        sendEmail(env, {
          to: [existing.email],
          subject: `You now have access to ${client.name} on the TMC portal`,
          html: accessGrantedHtml(existing.name, client.name),
        }).then(() => undefined),
      );
    }

    const { passwordHash: _ph, ...safe } = existing;
    return Response.json({ user: safe, attached: true }, { status: 200 });
  }

  // ── Create a new user ──
  const username = body.username?.trim().toLowerCase();
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase() || null;
  const password = body.password ?? "";
  if (!username || !name) {
    return Response.json(
      { error: "Username and name are required" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return Response.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  const existing = await getClientUserByUsername(db, username);
  if (existing) {
    return Response.json(
      { error: "Username already taken" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const created = await createClientUser(db, {
    clientId,
    username,
    passwordHash,
    name,
    email,
  });

  // Welcome email with login link + credentials (when we have an address).
  if (email) {
    ctx.waitUntil(
      sendEmail(env, {
        to: [email],
        subject: `Your ${client.name} portal login for TMC Marketing`,
        html: welcomeHtml(name, client.name, username, password),
      }).then(() => undefined),
    );
  }

  const { passwordHash: _ph, ...safe } = created;
  return Response.json({ user: safe, emailed: !!email }, { status: 201 });
};

function welcomeHtml(
  name: string,
  clientName: string,
  username: string,
  password: string,
): string {
  return `
    <div style="font-family:system-ui,sans-serif;color:#0E0F19;max-width:560px">
      <h2 style="margin:0 0 4px">Welcome to the TMC client portal</h2>
      <p style="color:#404E5C;margin:0 0 16px">
        Hi ${esc(name)}, TMC Marketing set up portal access for ${esc(clientName)}.
        You can view your shared files, submit requests, and send us event
        details to market.
      </p>
      <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">
        <tr><td style="padding:4px 12px 4px 0;color:#404E5C;font-weight:600">Portal</td>
            <td><a href="https://portal.tmctechhub.com" style="color:#A8884E">portal.tmctechhub.com</a></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#404E5C;font-weight:600">Username</td>
            <td style="font-family:monospace">${esc(username)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#404E5C;font-weight:600">Password</td>
            <td style="font-family:monospace">${esc(password)}</td></tr>
      </table>
      <p style="margin:0 0 16px">
        <a href="https://portal.tmctechhub.com"
           style="background:#CFB583;color:#0E0F19;font-weight:600;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">
          Log in to your portal
        </a>
      </p>
      <p style="color:#404E5C;font-size:12px">
        You'll be asked to choose your own password the first time you sign
        in. Forgot it later? Use "Forgot password?" on the sign-in page.
      </p>
    </div>`;
}

function accessGrantedHtml(name: string, clientName: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;color:#0E0F19;max-width:560px">
      <h2 style="margin:0 0 4px">New account access</h2>
      <p style="color:#404E5C;margin:0 0 16px">
        Hi ${esc(name)}, your TMC portal login now also has access to
        <strong>${esc(clientName)}</strong>. Use the account switcher on your
        portal home page to flip between accounts.
      </p>
      <p>
        <a href="https://portal.tmctechhub.com"
           style="background:#CFB583;color:#0E0F19;font-weight:600;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">
          Open the portal
        </a>
      </p>
    </div>`;
}
