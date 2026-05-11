import { sql } from "drizzle-orm";
import { sqliteTable, integer, real, text } from "drizzle-orm/sqlite-core";

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

// ─── Content pipeline ────────────────────────────────────────────────────

export const pillars = sqliteTable("pillars", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("404E5C"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type PillarRow = typeof pillars.$inferSelect;
export type NewPillarRow = typeof pillars.$inferInsert;

export const funnelStages = sqliteTable("funnel_stages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("404E5C"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type FunnelStageRow = typeof funnelStages.$inferSelect;
export type NewFunnelStageRow = typeof funnelStages.$inferInsert;

export const contentPosts = sqliteTable("content_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => recurringClients.id),
  title: text("title").notNull(),
  pillarId: integer("pillar_id").references(() => pillars.id),
  funnelStageId: integer("funnel_stage_id").references(() => funnelStages.id),
  scheduledDate: text("scheduled_date").notNull(),
  platform: text("platform"),
  status: text("status", {
    enum: ["idea", "drafting", "review", "approved", "scheduled", "posted"],
  }).notNull().default("idea"),
  assignedTo: integer("assigned_to").references(() => users.id),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type ContentPostRow = typeof contentPosts.$inferSelect;
export type NewContentPostRow = typeof contentPosts.$inferInsert;

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

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  filesUrl: text("files_url"),
  ghlUrl: text("ghl_url"),
  passwordVaultUrl: text("password_vault_url"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type ClientRow = typeof clients.$inferSelect;
export type NewClientRow = typeof clients.$inferInsert;

export const clientUsers = sqliteTable("client_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSignedIn: text("last_signed_in"),
});

export type ClientUserRow = typeof clientUsers.$inferSelect;
export type NewClientUserRow = typeof clientUsers.$inferInsert;

// ─── Finance dashboard ───────────────────────────────────────────────────

export const paymentMethods = sqliteTable("payment_methods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  feePct: real("fee_pct").notNull().default(0),
  feeFlat: integer("fee_flat").notNull().default(0),
  /** Compounds AFTER the initial fee. e.g. Wave Pro instant payout = 0.01. */
  instantPayoutPct: real("instant_payout_pct").notNull().default(0),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type PaymentMethodRow = typeof paymentMethods.$inferSelect;

export const expenseCategories = sqliteTable("expense_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  monthlyBudget: integer("monthly_budget"),
  color: text("color").notNull().default("404E5C"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type ExpenseCategoryRow = typeof expenseCategories.$inferSelect;
export type NewExpenseCategoryRow = typeof expenseCategories.$inferInsert;

export const recurringClients = sqliteTable("recurring_clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  monthlyAmount: integer("monthly_amount").notNull(),
  paymentMethodId: integer("payment_method_id").references(() => paymentMethods.id),
  invoiceDay: integer("invoice_day"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Posts/week for this client (1–7); null = not in content pipeline. */
  weeklyPostTarget: integer("weekly_post_target"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type RecurringClientRow = typeof recurringClients.$inferSelect;
export type NewRecurringClientRow = typeof recurringClients.$inferInsert;

export const recurringExpenses = sqliteTable("recurring_expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  categoryId: integer("category_id").references(() => expenseCategories.id),
  monthlyAmount: integer("monthly_amount").notNull(),
  paymentDay: integer("payment_day"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type RecurringExpenseRow = typeof recurringExpenses.$inferSelect;
export type NewRecurringExpenseRow = typeof recurringExpenses.$inferInsert;

export const oneOffInvoices = sqliteTable("one_off_invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientName: text("client_name").notNull(),
  grossAmount: integer("gross_amount").notNull(),
  paymentMethodId: integer("payment_method_id").references(() => paymentMethods.id),
  payoutDate: text("payout_date").notNull(),
  instantPayout: integer("instant_payout", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type OneOffInvoiceRow = typeof oneOffInvoices.$inferSelect;
export type NewOneOffInvoiceRow = typeof oneOffInvoices.$inferInsert;

export const oneTimeExpenses = sqliteTable("one_time_expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  categoryId: integer("category_id").references(() => expenseCategories.id),
  amount: integer("amount").notNull(),
  status: text("status", { enum: ["planned", "paid"] }).notNull().default("planned"),
  plannedDate: text("planned_date"),
  paidDate: text("paid_date"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type OneTimeExpenseRow = typeof oneTimeExpenses.$inferSelect;
export type NewOneTimeExpenseRow = typeof oneTimeExpenses.$inferInsert;

export const financeSettings = sqliteTable("finance_settings", {
  id: integer("id").primaryKey(),
  currentBalance: integer("current_balance").notNull().default(0),
  balanceUpdatedAt: text("balance_updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  notes: text("notes"),
  updatedBy: integer("updated_by").references(() => users.id),
});
export type FinanceSettingsRow = typeof financeSettings.$inferSelect;

export const calculatorSettings = sqliteTable("calculator_settings", {
  id: integer("id").primaryKey(),
  rateAdmin: integer("rate_admin").notNull().default(60),
  rateFt: integer("rate_ft").notNull().default(23),
  ratePt: integer("rate_pt").notNull().default(20),
  reviewTier: text("review_tier", { enum: ["admin", "ft", "pt", "none"] })
    .notNull()
    .default("admin"),
  reviewMins: integer("review_mins").notNull().default(5),
  softwareTotal: integer("software_total").notNull().default(2000),
  clientCount: integer("client_count").notNull().default(12),
  marginFloor: integer("margin_floor").notNull().default(30),
  billableRate: integer("billable_rate").notNull().default(150),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type CalculatorSettingsRow = typeof calculatorSettings.$inferSelect;
