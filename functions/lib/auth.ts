import { SignJWT, jwtVerify } from "jose";

export interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ALLOWED_DOMAIN: string;
}

export interface SessionUser {
  email: string;
  name: string;
  picture?: string;
}

const SESSION_COOKIE = "tmc_session";
const STATE_COOKIE = "tmc_oauth_state";
const SESSION_TTL_DAYS = 7;

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

function getRedirectUri(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/auth/callback`;
}

export function buildLoginUrl(request: Request, env: Env, state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
    hd: env.ALLOWED_DOMAIN,
  });
  return `${GOOGLE_AUTHORIZE_URL}?${params}`;
}

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

interface GoogleUserInfo {
  email: string;
  name: string;
  picture?: string;
  verified_email: boolean;
  hd?: string;
}

export async function exchangeCodeForUser(
  code: string,
  request: Request,
  env: Env,
): Promise<GoogleUserInfo> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(request),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${tokenRes.status}`);
  }
  const tokens = (await tokenRes.json()) as GoogleTokenResponse;

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) {
    throw new Error(`Google userinfo failed: ${userRes.status}`);
  }
  return (await userRes.json()) as GoogleUserInfo;
}

export function isEmailAllowed(email: string, allowedDomain: string): boolean {
  return email.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`);
}

export async function createSessionCookie(
  user: SessionUser,
  env: Env,
): Promise<string> {
  const jwt = await new SignJWT({
    email: user.email,
    name: user.name,
    picture: user.picture,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(getSecretKey(env.SESSION_SECRET));

  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function getSession(
  request: Request,
  env: Env,
): Promise<SessionUser | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(env.SESSION_SECRET));
    if (typeof payload.email !== "string" || typeof payload.name !== "string") {
      return null;
    }
    return {
      email: payload.email,
      name: payload.name,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}

export function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildStateCookie(state: string): string {
  return `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

export function clearStateCookie(): string {
  return `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readStateCookie(request: Request): string | null {
  return readCookie(request, STATE_COOKIE);
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}
