/* RANEEV data model — credential records and incident access constraints only; the existing UI is intentionally unaffected. */
import {
  boolean,
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
export const aiJobStatuses = ["pending", "processing", "completed", "failed"] as const;
export const aiAuditStatuses = ["succeeded", "failed", "fallback"] as const;
export const aiOperations = ["incident_enrichment", "coordinator_assistant"] as const;
export const notificationTypes = ["emergency_confirmation", "nearby_emergency", "responder_assigned", "responder_en_route", "responder_arrived", "incident_resolved", "coordinator_critical", "coordinator_no_responder", "coordinator_escalated", "assignment_cancelled", "reassignment_required"] as const;
export const notificationPriorities = ["critical", "high", "normal", "low"] as const;
export const notificationChannels = ["in_app", "sms"] as const;
export const notificationStatuses = ["pending", "delivered_demo", "sent", "failed"] as const;
export const notificationProviders = ["demo", "twilio", "fallback"] as const;

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
  volunteerSkills: varchar("volunteerSkills", { length: 500 }).notNull().default("[]"),
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

/** Optional AI work is isolated from emergency progression. Jobs may fail without changing an incident’s lifecycle or assignment. */
export const aiAnalysisJobs = mysqlTable("aiAnalysisJobs", {
  id: int("id").autoincrement().primaryKey(),
  incidentId: int("incidentId").notNull().references(() => incidents.id).unique(),
  status: mysqlEnum("status", aiJobStatuses).notNull().default("pending"),
  attemptCount: int("attemptCount").notNull().default(0),
  lastErrorCode: varchar("lastErrorCode", { length: 120 }),
  scheduledAt: timestamp("scheduledAt").defaultNow().notNull(),
  lockedAt: timestamp("lockedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("ai_jobs_status_schedule_idx").on(table.status, table.scheduledAt)]);

/** Minimized metadata and validated structured output for optional AI operations. Raw prompts and profile data are not persisted. */
export const aiIncidentAudits = mysqlTable("aiIncidentAudits", {
  id: int("id").autoincrement().primaryKey(),
  incidentId: int("incidentId").references(() => incidents.id),
  actorUserId: int("actorUserId").references(() => users.id),
  operation: mysqlEnum("operation", aiOperations).notNull(),
  status: mysqlEnum("status", aiAuditStatuses).notNull(),
  modelIdentifier: varchar("modelIdentifier", { length: 120 }),
  inputMetadata: varchar("inputMetadata", { length: 500 }).notNull(),
  outputJson: varchar("outputJson", { length: 6_000 }),
  confidencePercent: int("confidencePercent"),
  failureCode: varchar("failureCode", { length: 120 }),
  durationMs: int("durationMs").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("ai_audits_incident_created_idx").on(table.incidentId, table.createdAt), index("ai_audits_operation_created_idx").on(table.operation, table.createdAt)]);

/** Recipient-scoped, idempotent notification deliveries. No private incident details are required for SMS transport. */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  dedupeKey: varchar("dedupeKey", { length: 180 }).notNull().unique(),
  recipientUserId: int("recipientUserId").notNull().references(() => users.id),
  incidentId: int("incidentId").references(() => incidents.id),
  type: mysqlEnum("type", notificationTypes).notNull(),
  priority: mysqlEnum("priority", notificationPriorities).notNull().default("normal"),
  channel: mysqlEnum("channel", notificationChannels).notNull().default("in_app"),
  status: mysqlEnum("status", notificationStatuses).notNull().default("pending"),
  provider: mysqlEnum("provider", notificationProviders).notNull().default("demo"),
  title: varchar("title", { length: 180 }).notNull(),
  message: varchar("message", { length: 500 }).notNull(),
  providerMessageId: varchar("providerMessageId", { length: 120 }),
  errorMessage: varchar("errorMessage", { length: 500 }),
  sentAt: timestamp("sentAt"),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("notifications_recipient_unread_idx").on(table.recipientUserId, table.readAt, table.createdAt), index("notifications_incident_created_idx").on(table.incidentId, table.createdAt), index("notifications_status_created_idx").on(table.status, table.createdAt)]);

/** Critical in-app alerts cannot be disabled; these preferences apply only to optional channels and normal updates. */
export const notificationPreferences = mysqlTable("notificationPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id).unique(),
  inAppEnabled: boolean("inAppEnabled").notNull().default(true),
  smsEnabled: boolean("smsEnabled").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppRole = (typeof appRoles)[number];
export type ProfileStatus = (typeof profileStatuses)[number];
export type VolunteerAvailability = (typeof volunteerAvailabilityStates)[number];
export type EmergencyType = (typeof emergencyTypes)[number];
export type GhrSeverity = (typeof ghrSeverityLevels)[number];
export type GhrEscalation = (typeof ghrEscalationStates)[number];
export type IncidentEventType = (typeof incidentEventTypes)[number];
export type AiJobStatus = (typeof aiJobStatuses)[number];
export type AiAuditStatus = (typeof aiAuditStatuses)[number];
export type AiOperation = (typeof aiOperations)[number];
export type NotificationType = (typeof notificationTypes)[number];
export type NotificationPriority = (typeof notificationPriorities)[number];
export type NotificationChannel = (typeof notificationChannels)[number];
export type NotificationStatus = (typeof notificationStatuses)[number];
export type NotificationProvider = (typeof notificationProviders)[number];
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type IncidentEvent = typeof incidentEvents.$inferSelect;
export type AiAnalysisJob = typeof aiAnalysisJobs.$inferSelect;
export type AiIncidentAudit = typeof aiIncidentAudits.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
