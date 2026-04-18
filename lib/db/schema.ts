import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core"

// Better Auth tables
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
  scope: text("scope"),
  idToken: text("idToken"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
})

// App tables
export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    workflowRunId: text("workflow_run_id"),
    status: text("status").notNull().default("running"), // running | completed | failed
    trigger: text("trigger").notNull().default("manual"), // manual | cron
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    emailsScanned: integer("emails_scanned").notNull().default(0),
    error: text("error"),
  },
  (t) => ({
    startedAtIdx: index("runs_started_at_idx").on(t.startedAt),
  }),
)

export const digests = pgTable(
  "digests",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    summary: text("summary"),
  },
  (t) => ({
    runIdIdx: index("digests_run_id_idx").on(t.runId),
  }),
)

export const digestItems = pgTable(
  "digest_items",
  {
    id: text("id").primaryKey(),
    digestId: text("digest_id")
      .notNull()
      .references(() => digests.id, { onDelete: "cascade" }),
    messageId: text("message_id"),
    threadId: text("thread_id"),
    category: text("category").notNull(), // urgent | reply | fyi | noise
    subject: text("subject"),
    sender: text("sender"),
    snippet: text("snippet"),
    summary: text("summary"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
  },
  (t) => ({
    digestIdIdx: index("digest_items_digest_id_idx").on(t.digestId),
    categoryIdx: index("digest_items_category_idx").on(t.category),
  }),
)

export const gmailConnection = pgTable("gmail_connection", {
  id: text("id").primaryKey().default("singleton"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  scopes: text("scopes").notNull(),
  status: text("status").notNull().default("active"), // active | expired | revoked
  lastError: text("last_error"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Run = typeof runs.$inferSelect
export type Digest = typeof digests.$inferSelect
export type DigestItem = typeof digestItems.$inferSelect
export type GmailConnection = typeof gmailConnection.$inferSelect
export type Category = "urgent" | "reply" | "fyi" | "noise"
