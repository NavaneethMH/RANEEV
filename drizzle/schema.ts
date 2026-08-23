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
export const volunteerAvailabilityStates = ["offline", "available", "busy"] as const;
export const incidentStatuses = ["active", "searching", "accepted", "en_route", "arrived", "assisting", "resolved", "cancelled"] as const;
export const emergencyTypes = ["medical", "road_accident", "injury", "fire", "unconscious", "other"] as const;
export const ghrSeverityLevels = ["unassessed", "standard", "urgent", "critical"] as const;
export const ghrEscalationStates = ["not_escalated", "monitoring", "facility_contacted", "professional_services_contacted"] as const;
export const incidentEventTypes = ["created", "search_started", "responder_accepted", "en_route", "arrived", "assistance_started", "severity_assessed", "facility_selected", "escalated", "resolved"] as const;

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
  volunteerAvailability: mysqlEnum("volunteerAvailability", volunteerAvailabilityStates).notNull().default("offline"),
  volunteerLatitudeE6: int("volunteerLatitudeE6"),
  volunteerLongitudeE6: int("volunteerLongitudeE6"),
  volunteerLocationUpdatedAt: timestamp("volunteerLocationUpdatedAt"),
  verifiedAt: timestamp("verifiedAt"),
  sessionVersion: int("sessionVersion").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, table => [index("users_role_idx").on(table.role), index("users_status_idx").on(table.profileStatus)]);

/** Persisted emergency-request state for the Citizen golden-path workflow. Coordinate values are integer microdegrees to avoid floating-point drift. */
export const incidents = mysqlTable("incidents", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 40 }).notNull().unique(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  assignedVolunteerId: int("assignedVolunteerId").references(() => users.id),
  status: mysqlEnum("status", incidentStatuses).notNull().default("searching"),
  emergencyType: mysqlEnum("emergencyType", emergencyTypes).notNull().default("other"),
  locationLabel: varchar("locationLabel", { length: 255 }).notNull().default("Location pending"),
  latitudeE6: int("latitudeE6").notNull().default(0),
  longitudeE6: int("longitudeE6").notNull().default(0),
  accuracyMeters: int("accuracyMeters").notNull().default(0),
  description: varchar("description", { length: 500 }),
  responderEtaMinutes: int("responderEtaMinutes"),
  responderLatitudeE6: int("responderLatitudeE6"),
  responderLongitudeE6: int("responderLongitudeE6"),
  responderLocationUpdatedAt: timestamp("responderLocationUpdatedAt"),
  acceptedAt: timestamp("acceptedAt"),
  arrivedAt: timestamp("arrivedAt"),
  assistanceStartedAt: timestamp("assistanceStartedAt"),
  ghrSeverity: mysqlEnum("ghrSeverity", ghrSeverityLevels).notNull().default("unassessed"),
  ghrEscalation: mysqlEnum("ghrEscalation", ghrEscalationStates).notNull().default("not_escalated"),
  ghrEscalationNote: varchar("ghrEscalationNote", { length: 500 }),
  ghrEscalatedAt: timestamp("ghrEscalatedAt"),
  ghrFacilityName: varchar("ghrFacilityName", { length: 255 }),
  ghrFacilityPlaceId: varchar("ghrFacilityPlaceId", { length: 255 }),
  ghrFacilityLatitudeE6: int("ghrFacilityLatitudeE6"),
  ghrFacilityLongitudeE6: int("ghrFacilityLongitudeE6"),
  ghrFacilityDistanceMeters: int("ghrFacilityDistanceMeters"),
  ghrFacilityEtaMinutes: int("ghrFacilityEtaMinutes"),
  ghrFacilitySelectedAt: timestamp("ghrFacilitySelectedAt"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("incidents_creator_idx").on(table.createdByUserId),
  index("incidents_volunteer_idx").on(table.assignedVolunteerId),
  index("incidents_status_idx").on(table.status),
]);

/** Minimal immutable event timeline used to explain each verified lifecycle transition to the citizen. */
export const incidentEvents = mysqlTable("incidentEvents", {
  id: int("id").autoincrement().primaryKey(),
  incidentId: int("incidentId").notNull().references(() => incidents.id),
  actorUserId: int("actorUserId").references(() => users.id),
  eventType: mysqlEnum("eventType", incidentEventTypes).notNull(),
  note: varchar("note", { length: 500 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("incident_events_incident_idx").on(table.incidentId), index("incident_events_created_idx").on(table.createdAt)]);

export type AppRole = (typeof appRoles)[number];
export type ProfileStatus = (typeof profileStatuses)[number];
export type VolunteerAvailability = (typeof volunteerAvailabilityStates)[number];
export type EmergencyType = (typeof emergencyTypes)[number];
export type GhrSeverity = (typeof ghrSeverityLevels)[number];
export type GhrEscalation = (typeof ghrEscalationStates)[number];
export type IncidentEventType = (typeof incidentEventTypes)[number];
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type IncidentEvent = typeof incidentEvents.$inferSelect;
