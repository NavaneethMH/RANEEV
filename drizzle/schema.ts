/* RANEEV data model — credential records and incident access constraints only; the existing UI is intentionally unaffected. */
import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const appRoles = ["citizen", "volunteer", "coordinator", "admin"] as const;
export const profileStatuses = ["active", "pending_verification", "suspended"] as const;
export const incidentStatuses = ["active", "searching", "accepted", "en_route", "arrived", "resolved", "cancelled"] as const;

/**
 * `openId` remains the stable internal subject key for template compatibility.
 * Password credentials are never stored here—only a salted scrypt hash lives in `passwordHash`.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 96 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  phone: varchar("phone", { length: 32 }),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  loginMethod: varchar("loginMethod", { length: 32 }).notNull().default("credentials"),
  role: mysqlEnum("role", appRoles).notNull().default("citizen"),
  profileStatus: mysqlEnum("profileStatus", profileStatuses).notNull().default("active"),
  sessionVersion: int("sessionVersion").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, table => [index("users_role_idx").on(table.role), index("users_status_idx").on(table.profileStatus)]);

/** Minimal ownership model used to prove server-side incident visibility rules before the full emergency backend is built. */
export const incidents = mysqlTable("incidents", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 40 }).notNull().unique(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  assignedVolunteerId: int("assignedVolunteerId").references(() => users.id),
  status: mysqlEnum("status", incidentStatuses).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("incidents_creator_idx").on(table.createdByUserId),
  index("incidents_volunteer_idx").on(table.assignedVolunteerId),
  index("incidents_status_idx").on(table.status),
]);

export type AppRole = (typeof appRoles)[number];
export type ProfileStatus = (typeof profileStatuses)[number];
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
