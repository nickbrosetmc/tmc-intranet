// Personal API tokens for programmatic access (agents, scripts).
// Format: "tmc_" + 64 hex chars (256-bit CSPRNG). Stored as SHA-256 hash.

import { and, eq, isNull, sql } from "drizzle-orm";
import { apiTokens, users, type UserRow } from "../db/schema";
import type { DB } from "../db";

export function generateApiToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return (
    "tmc_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ResolvedToken {
  tokenId: number;
  scope: "read" | "write";
  user: UserRow;
}

/**
 * Resolve a raw bearer token to its owning user. Returns null for unknown,
 * revoked, or malformed tokens. Touches last_used_at on success.
 */
export async function resolveApiToken(
  db: DB,
  rawToken: string,
): Promise<ResolvedToken | null> {
  if (!/^tmc_[0-9a-f]{64}$/.test(rawToken)) return null;
  const hash = await sha256Hex(rawToken);
  const row = await db
    .select({
      tokenId: apiTokens.id,
      scope: apiTokens.scope,
      userId: apiTokens.userId,
    })
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hash), isNull(apiTokens.revokedAt)))
    .get();
  if (!row) return null;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, row.userId))
    .get();
  if (!user) return null;

  await db
    .update(apiTokens)
    .set({ lastUsedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(apiTokens.id, row.tokenId))
    .run();

  return { tokenId: row.tokenId, scope: row.scope, user };
}
