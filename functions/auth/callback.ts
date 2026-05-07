import {
  clearStateCookie,
  createSessionCookie,
  exchangeCodeForUser,
  readStateCookie,
  type Env,
} from "../lib/auth";
import { getDb, getUserByEmail, recordSignIn } from "../db";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return errorPage(`Google sign-in error: ${error}`);
  }
  if (!code || !state) {
    return errorPage("Missing code or state from Google.");
  }

  const expectedState = readStateCookie(request);
  if (!expectedState || expectedState !== state) {
    return errorPage("Invalid OAuth state. Please try signing in again.");
  }

  let googleUser;
  try {
    googleUser = await exchangeCodeForUser(code, request, env);
  } catch (e) {
    return errorPage(`Failed to verify Google account: ${(e as Error).message}`);
  }

  if (!googleUser.verified_email) {
    return errorPage("Your Google account email is not verified.");
  }

  const db = getDb(env.DB);
  const row = await getUserByEmail(db, googleUser.email);
  if (!row) {
    return errorPage(
      `${googleUser.email} isn't on the TMC Tech Hub invite list. Ask Nick to add you.`,
    );
  }

  await recordSignIn(db, googleUser.email, {
    name: googleUser.name,
    picture: googleUser.picture,
  });

  const sessionCookie = await createSessionCookie(
    {
      type: "team",
      email: row.email,
      name: googleUser.name,
      picture: googleUser.picture,
      role: row.role,
    },
    env,
  );

  const headers = new Headers();
  headers.append("Location", "/");
  headers.append("Set-Cookie", sessionCookie);
  headers.append("Set-Cookie", clearStateCookie());

  return new Response(null, { status: 302, headers });
};

function errorPage(message: string): Response {
  const safe = message.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Sign-in error</title>
<style>body{font:16px/1.4 system-ui;padding:48px;max-width:480px;margin:0 auto;color:#0E0F19;background:#F1F1F0}
h1{color:#404E5C}a{color:#CFB583;font-weight:500}</style></head>
<body><h1>Couldn't sign you in</h1><p>${safe}</p><p><a href="/auth/login">Try again</a></p></body></html>`;
  return new Response(html, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
