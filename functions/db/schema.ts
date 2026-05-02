import { sql } from "drizzle-orm";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name"),
  picture: text("picture"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  invitedBy: integer("invited_by").references((): any => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSignedIn: text("last_signed_in"),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

export const appGroups = sqliteTable("app_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type AppGroupRow = typeof appGroups.$inferSelect;

export const apps = sqliteTable("apps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  iconEmoji: text("icon_emoji"),
  iconBgColor: text("icon_bg_color"),
  desktopProtocol: text("desktop_protocol"),
  webUrl: text("web_url"),
  groupId: integer("group_id").references(() => appGroups.id),
  sortOrder: integer("sort_order").notNull().default(0),
  isComingSoon: integer("is_coming_soon", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type AppRow = typeof apps.$inferSelect;
export type NewAppRow = typeof apps.$inferInsert;

export const appLaunches = sqliteTable("app_launches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  appId: integer("app_id").notNull().references(() => apps.id),
  launchType: text("launch_type", { enum: ["desktop", "web"] }).notNull(),
  launchedAt: text("launched_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type AppLaunchRow = typeof appLaunches.$inferSelect;
export type NewAppLaunchRow = typeof appLaunches.$inferInsert;

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type AnnouncementRow = typeof announcements.$inferSelect;
export type NewAnnouncementRow = typeof announcements.$inferInsert;
