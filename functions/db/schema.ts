import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  primaryKey,
  real,
  text,
} from "drizzle-orm/sqlite-core";

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
  /** Target % of monthly content for this pillar. Null = no target. */
  targetPct: integer("target_pct"),
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
    enum: ["idea", "drafting", "review", "completed"],
  }).notNull().default("idea"),
  assignedTo: integer("assigned_to").references(() => users.id),
  reviewerId: integer("reviewer_id").references(() => users.id),
  estimatedMinutes: integer("estimated_minutes"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type ContentPostRow = typeof contentPosts.$inferSelect;
export type NewContentPostRow = typeof contentPosts.$inferInsert;

export const contentSettings = sqliteTable("content_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type ContentSettingRow = typeof contentSettings.$inferSelect;

// One row per (client, production-week) that has been auto-seeded. The
// composite primary key is the atomic claim: the first dashboard load to
// INSERT it wins and seeds; concurrent loads hit the PK conflict and skip,
// so a fresh week can't be double-seeded into duplicate blank posts.
export const contentSeedLog = sqliteTable(
  "content_seed_log",
  {
    clientId: integer("client_id")
      .notNull()
      .references(() => recurringClients.id),
    weekStart: text("week_start").notNull(), // YYYY-MM-DD, Monday of the seeded week
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.clientId, t.weekStart] }),
  }),
);
export type ContentSeedLogRow = typeof contentSeedLog.$inferSelect;

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

export const clientSubmissions = sqliteTable("client_submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  clientUserId: integer("client_user_id")
    .notNull()
    .references(() => clientUsers.id),
  type: text("type", { enum: ["request", "event"] }).notNull(),
  subject: text("subject").notNull(),
  details: text("details").notNull(),
  eventDate: text("event_date"),
  location: text("location"),
  status: text("status", { enum: ["new", "in_progress", "done"] })
    .notNull()
    .default("new"),
  adminNotes: text("admin_notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type ClientSubmissionRow = typeof clientSubmissions.$inferSelect;
export type NewClientSubmissionRow = typeof clientSubmissions.$inferInsert;

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
  /** Comma-separated lowercase 3-letter day codes (e.g. "tue,fri"); null = no fixed schedule. */
  postingDays: text("posting_days"),
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
  rateDayHalf: integer("rate_day_half").notNull().default(1800),
  rateDayFull: integer("rate_day_full").notNull().default(2800),
  rateDayExtra: integer("rate_day_extra").notNull().default(2500),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type CalculatorSettingsRow = typeof calculatorSettings.$inferSelect;

// ─── Time clock ──────────────────────────────────────────────────────────

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  payRateType: text("pay_rate_type", { enum: ["hourly", "salaried", "day_rate"] })
    .notNull(),
  payRate: real("pay_rate").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type JobRow = typeof jobs.$inferSelect;
export type NewJobRow = typeof jobs.$inferInsert;

export const jobEligibility = sqliteTable("job_eligibility", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull().references(() => jobs.id),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type JobEligibilityRow = typeof jobEligibility.$inferSelect;
export type NewJobEligibilityRow = typeof jobEligibility.$inferInsert;

export const timeClockShifts = sqliteTable("time_clock_shifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  jobId: integer("job_id").notNull().references(() => jobs.id),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  notes: text("notes"),
  status: text("status", {
    enum: ["active", "completed", "pending", "denied"],
  })
    .notNull()
    .default("active"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: text("approved_at"),
  denialReason: text("denial_reason"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type TimeClockShiftRow = typeof timeClockShifts.$inferSelect;
export type NewTimeClockShiftRow = typeof timeClockShifts.$inferInsert;

// ─── Time off ────────────────────────────────────────────────────────────

export const timeOffRequests = sqliteTable("time_off_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  reason: text("reason"),
  coveragePlan: text("coverage_plan").notNull(),
  status: text("status", {
    enum: ["pending", "approved", "denied", "cancelled"],
  })
    .notNull()
    .default("pending"),
  decidedBy: integer("decided_by").references(() => users.id),
  decidedAt: text("decided_at"),
  adminNote: text("admin_note"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type TimeOffRequestRow = typeof timeOffRequests.$inferSelect;
export type NewTimeOffRequestRow = typeof timeOffRequests.$inferInsert;

// ─── Tasks ───────────────────────────────────────────────────────────────

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: integer("assignee_id").notNull().references(() => users.id),
  createdBy: integer("created_by").notNull().references(() => users.id),
  priority: text("priority", {
    enum: ["low", "medium", "high", "urgent"],
  })
    .notNull()
    .default("medium"),
  dueDate: text("due_date"),
  estimatedMinutes: integer("estimated_minutes"),
  actualMinutes: integer("actual_minutes"),
  status: text("status", {
    enum: ["pending", "in_progress", "completed", "cancelled"],
  })
    .notNull()
    .default("pending"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  contentPostId: integer("content_post_id").references(() => contentPosts.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;

// ─── Website editor ──────────────────────────────────────────────────────

export const siteProjects = sqliteTable("site_projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  domain: text("domain"),
  headerHtml: text("header_html").notNull().default(""),
  footerHtml: text("footer_html").notNull().default(""),
  themeJson: text("theme_json"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type SiteProjectRow = typeof siteProjects.$inferSelect;
export type NewSiteProjectRow = typeof siteProjects.$inferInsert;

export const sitePages = sqliteTable("site_pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => siteProjects.id),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  bodyHtml: text("body_html").notNull().default(""),
  navOrder: integer("nav_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type SitePageRow = typeof sitePages.$inferSelect;
export type NewSitePageRow = typeof sitePages.$inferInsert;

export const siteSubmissions = sqliteTable("site_submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => siteProjects.id),
  clientUserId: integer("client_user_id").references(() => clientUsers.id),
  submittedByName: text("submitted_by_name").notNull(),
  status: text("status", { enum: ["pending", "published", "dismissed"] })
    .notNull()
    .default("pending"),
  changesJson: text("changes_json").notNull().default("[]"),
  blocksJson: text("blocks_json").notNull().default("[]"),
  doneJson: text("done_json").notNull().default("[]"),
  publishedBy: integer("published_by").references(() => users.id),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type SiteSubmissionRow = typeof siteSubmissions.$inferSelect;
export type NewSiteSubmissionRow = typeof siteSubmissions.$inferInsert;

export const siteRequests = sqliteTable("site_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => siteProjects.id),
  clientUserId: integer("client_user_id").references(() => clientUsers.id),
  submittedByName: text("submitted_by_name").notNull(),
  body: text("body").notNull(),
  assetKey: text("asset_key"),
  assetName: text("asset_name"),
  status: text("status", { enum: ["pending", "handled"] })
    .notNull()
    .default("pending"),
  handledBy: integer("handled_by").references(() => users.id),
  handledAt: text("handled_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type SiteRequestRow = typeof siteRequests.$inferSelect;
export type NewSiteRequestRow = typeof siteRequests.$inferInsert;

export const siteAssets = sqliteTable("site_assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => siteProjects.id),
  r2Key: text("r2_key").notNull().unique(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  uploadedByClientUserId: integer("uploaded_by_client_user_id").references(
    () => clientUsers.id,
  ),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type SiteAssetRow = typeof siteAssets.$inferSelect;
export type NewSiteAssetRow = typeof siteAssets.$inferInsert;

export const siteContentBlocks = sqliteTable("site_content_blocks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => siteProjects.id),
  name: text("name").notNull(),
  html: text("html").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export type SiteContentBlockRow = typeof siteContentBlocks.$inferSelect;
export type NewSiteContentBlockRow = typeof siteContentBlocks.$inferInsert;
