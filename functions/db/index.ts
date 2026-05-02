import { drizzle } from "drizzle-orm/d1";
import { eq, sql } from "drizzle-orm";
import { users, type UserRow } from "./schema";

export type DB = ReturnType<typeof drizzle>;

export function getDb(d1: D1Database): DB {
  return drizzle(d1);
}

export async function getUserByEmail(
  db: DB,
  email: string,
): Promise<UserRow | null> {
  const row = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .get();
  return row ?? null;
}

/** Refresh profile fields from Google + bump last_signed_in. */
export async function recordSignIn(
  db: DB,
  email: string,
  profile: { name: string; picture?: string },
): Promise<void> {
  await db
    .update(users)
    .set({
      name: profile.name,
      picture: profile.picture,
      lastSignedIn: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(users.email, email.toLowerCase()))
    .run();
}
