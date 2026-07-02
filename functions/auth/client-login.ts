import {
  createSessionCookie,
  type Env,
} from "../lib/auth";
import {
  getClientById,
  getClientUserByUsername,
  getDb,
  recordClientUserSignIn,
} from "../db";
import { listMembershipsForUser } from "../db/admin";
import { verifyPassword } from "../lib/passwords";

interface LoginBody {
  username?: string;
  password?: string;
}

const GENERIC_ERROR = "Invalid username or password";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = body.username?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!username || !password) {
    return Response.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const db = getDb(env.DB);
  const user = await getClientUserByUsername(db, username);
  if (!user || !user.isActive) {
    // Generic error to avoid disclosing whether username exists
    return Response.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return Response.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  // Resolve which client account to land in: the primary if it's still an
  // active membership, otherwise the first active membership.
  const memberships = await listMembershipsForUser(db, user.id);
  if (memberships.length === 0) {
    return Response.json(
      { error: "Your account belongs to an inactive client. Contact TMC." },
      { status: 403 },
    );
  }
  const active =
    memberships.find((m) => m.clientId === user.clientId) ?? memberships[0];
  const client = await getClientById(db, active.clientId);
  if (!client || !client.isActive) {
    return Response.json(
      { error: "Your account belongs to an inactive client. Contact TMC." },
      { status: 403 },
    );
  }

  await recordClientUserSignIn(db, user.id);

  const cookie = await createSessionCookie(
    {
      type: "client",
      clientUserId: user.id,
      clientId: client.id,
      username: user.username,
      name: user.name,
    },
    env,
  );

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
};
