/* RANEEV database access — all credential and incident queries return the minimum fields needed for server authorization. */
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { AiAnalysisJob, AppRole, DemoRunStatus, DemoStage, EmergencyType, GhrEscalation, GhrSeverity, Incident, IncidentEvent, InsertUser, NotificationChannel, NotificationPriority, NotificationProvider, NotificationStatus, NotificationType, User, VolunteerAvailability } from "../drizzle/schema";
import { aiAnalysisJobs, aiIncidentAudits, demoRuns, incidentEvents, incidents, notificationPreferences, notifications, users } from "../drizzle/schema";
import type { ResponderType } from "./ai/contracts";
import { parseResponderSkills, scoreResponders } from "./ai/matching";
import { averageAcceptanceMinutes, coordinatorPriority } from "./coordinator/metrics";
import { canCloseGoldenHourResponse, isGoldenHourActive } from "./ghr/policy";
import { canTransition, lifecycleEventFor, type ManagedIncidentStatus } from "./incidents/lifecycle";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const database = await getDb();
  if (!database) throw new Error("Database is unavailable");
  return database;
}

export async function getUserById(id: number) {
  const database = await requireDb();
  const result = await database.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getUserByEmail(email: string) {
  const database = await requireDb();
  const result = await database.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return result[0] ?? null;
}

export async function getUserByOpenId(openId: string) {
  const database = await requireDb();
  const result = await database.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? null;
}

export async function createCredentialUser(user: Pick<InsertUser, "openId" | "name" | "email" | "phone" | "passwordHash" | "role" | "profileStatus">) {
  const database = await requireDb();
  await database.insert(users).values({ ...user, email: user.email.toLowerCase(), loginMethod: "credentials" });
  const created = await getUserByEmail(user.email);
  if (!created) throw new Error("Credential account creation did not return a user");
  return created;
}

/** Compatibility guard for the unregistered OAuth scaffold; credential authentication never calls this path. */
export async function upsertUser(_user: Partial<InsertUser>): Promise<void> {
  throw new Error("The OAuth user-sync path is disabled for RANEEV credential authentication.");
}

export async function updateProfile(userId: number, input: { name: string; phone: string | null }) {
  const database = await requireDb();
  await database.update(users).set({ name: input.name, phone: input.phone }).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function updateUserRole(userId: number, role: AppRole) {
  const database = await requireDb();
  await database.update(users).set({ role, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
  return getUserById(userId);
}

export const DEMO_RUN_KEY = "raneev-primary-demo";

export async function getDemoRun() {
  const database = await requireDb();
  const result = await database.select().from(demoRuns).where(eq(demoRuns.runKey, DEMO_RUN_KEY)).limit(1);
  return result[0] ?? null;
}

export async function saveDemoRun(input: { status: DemoRunStatus; stage: DemoStage; incidentId: number | null; startedAt: Date | null; pausedAt: Date | null; accumulatedPausedMs: number; completedAt: Date | null }) {
  const database = await requireDb();
  await database.insert(demoRuns).values({ runKey: DEMO_RUN_KEY, ...input }).onDuplicateKeyUpdate({ set: input });
  return getDemoRun();
}

export async function createDemoIncident(input: { publicId: string; createdByUserId: number; locationLabel: string; latitudeE6: number; longitudeE6: number; description: string }) {
  const database = await requireDb();
  await database.insert(incidents).values({
    publicId: input.publicId,
    createdByUserId: input.createdByUserId,
    emergencyType: "road_accident",
    locationLabel: input.locationLabel,
    latitudeE6: input.latitudeE6,
    longitudeE6: input.longitudeE6,
    accuracyMeters: 12,
    description: input.description,
    status: "searching",
    ghrSeverity: "critical",
    isDemo: true,
  });
  const created = await getIncidentByPublicId(input.publicId);
  if (!created || !created.isDemo) throw new Error("Demo incident could not be persisted.");
  await addIncidentEvent({ incidentId: created.id, actorUserId: input.createdByUserId, eventType: "created", note: "DEMO: Road accident scenario created for controlled presentation." });
  await addIncidentEvent({ incidentId: created.id, actorUserId: null, eventType: "search_started", note: "DEMO: Golden Hour Response active; searching the designated demo responder." });
  await addIncidentEvent({ incidentId: created.id, actorUserId: null, eventType: "severity_assessed", note: "DEMO: AI-assisted classification fallback — road accident, critical, First Aid / Medical responder recommended." });
  await addAiIncidentAudit({ incidentId: created.id, actorUserId: null, operation: "incident_enrichment", status: "fallback", modelIdentifier: null, inputMetadata: "demo-mode deterministic road accident scenario", outputJson: JSON.stringify({ enrichment: { classification: { category: "accident", severity: "critical", recommendedResponderType: "medical", confidence: 100, reason: "Deterministic Demo Mode fallback." }, summary: { summary: "Demo road accident requiring immediate first-aid response.", knownFacts: ["Road accident", "Two affected people", "Demo training location"], unknownInformation: [], priority: "critical" }, recommendation: { requiredSkills: ["medical"], recommendedResponderType: "medical", reason: "Configured Demo Mode responder profile." } } }), confidencePercent: 100, failureCode: "DEMO_DETERMINISTIC_FALLBACK", durationMs: 0 });
  return created;
}

export async function addDemoIncidentEvent(incidentId: number, actorUserId: number | null, eventType: IncidentEvent["eventType"], note: string) {
  await addIncidentEvent({ incidentId, actorUserId, eventType, note: `DEMO: ${note}` });
}

export async function updateDemoResponderPosition(publicId: string, volunteerUserId: number, latitudeE6: number, longitudeE6: number, responderEtaMinutes: number) {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident || !incident.isDemo || incident.assignedVolunteerId !== volunteerUserId) return null;
  const database = await requireDb();
  await database.update(incidents).set({ responderLatitudeE6: latitudeE6, responderLongitudeE6: longitudeE6, responderEtaMinutes, responderLocationUpdatedAt: new Date() }).where(eq(incidents.id, incident.id));
  return getIncidentByPublicId(publicId);
}

export async function deleteDemoIncidentArtifacts(incidentId: number) {
  const incident = await getIncidentById(incidentId);
  if (!incident?.isDemo) return;
  const database = await requireDb();
  await database.update(demoRuns).set({ incidentId: null }).where(eq(demoRuns.incidentId, incidentId));
  await database.delete(notifications).where(eq(notifications.incidentId, incidentId));
  await database.delete(aiAnalysisJobs).where(eq(aiAnalysisJobs.incidentId, incidentId));
  await database.delete(aiIncidentAudits).where(eq(aiIncidentAudits.incidentId, incidentId));
  await database.delete(incidentEvents).where(eq(incidentEvents.incidentId, incidentId));
  await database.delete(incidents).where(eq(incidents.id, incidentId));
}

export async function getNotificationPreferences(userId: number) {
  const database = await requireDb();
  const result = await database.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
  return result[0] ?? { userId, inAppEnabled: true, smsEnabled: false };
}

export async function updateNotificationPreferences(userId: number, input: { inAppEnabled: boolean; smsEnabled: boolean }) {
  const database = await requireDb();
  await database.insert(notificationPreferences).values({ userId, ...input }).onDuplicateKeyUpdate({ set: input });
  return getNotificationPreferences(userId);
}

export async function createNotificationIfAbsent(input: { dedupeKey: string; recipientUserId: number; incidentId: number | null; type: NotificationType; priority: NotificationPriority; channel: NotificationChannel; status: NotificationStatus; provider: NotificationProvider; title: string; message: string; providerMessageId?: string | null; errorMessage?: string | null; sentAt?: Date | null }) {
  const database = await requireDb();
  const existing = await database.select().from(notifications).where(eq(notifications.dedupeKey, input.dedupeKey)).limit(1);
  if (existing[0]) return { notification: existing[0], created: false };
  try {
    await database.insert(notifications).values(input);
  } catch (error) {
    const duplicate = await database.select().from(notifications).where(eq(notifications.dedupeKey, input.dedupeKey)).limit(1);
    if (duplicate[0]) return { notification: duplicate[0], created: false };
    throw error;
  }
  const created = await database.select().from(notifications).where(eq(notifications.dedupeKey, input.dedupeKey)).limit(1);
  if (!created[0]) throw new Error("Notification delivery record did not return after creation.");
  return { notification: created[0], created: true };
}

export async function updateNotificationDelivery(id: number, input: { status: NotificationStatus; provider: NotificationProvider; providerMessageId?: string | null; errorMessage?: string | null; sentAt?: Date | null }) {
  const database = await requireDb();
  await database.update(notifications).set(input).where(eq(notifications.id, id));
  const result = await database.select().from(notifications).where(eq(notifications.id, id)).limit(1);
  return result[0] ?? null;
}

export async function listNotificationsForUser(userId: number, limit = 40) {
  const database = await requireDb();
  return database.select({ notification: notifications, publicId: incidents.publicId, incidentStatus: incidents.status }).from(notifications).leftJoin(incidents, eq(notifications.incidentId, incidents.id)).where(eq(notifications.recipientUserId, userId)).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(limit);
}

export async function listNotificationAudits(limit = 80) {
  const database = await requireDb();
  return database.select({
    id: notifications.id, type: notifications.type, priority: notifications.priority, channel: notifications.channel, status: notifications.status, provider: notifications.provider,
    errorMessage: notifications.errorMessage, sentAt: notifications.sentAt, readAt: notifications.readAt, createdAt: notifications.createdAt,
    recipientRole: users.role, publicId: incidents.publicId,
  }).from(notifications).innerJoin(users, eq(notifications.recipientUserId, users.id)).leftJoin(incidents, eq(notifications.incidentId, incidents.id)).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(limit);
}

export async function countUnreadNotifications(userId: number) {
  const database = await requireDb();
  const result = await database.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.recipientUserId, userId), isNull(notifications.readAt)));
  return Number(result[0]?.count ?? 0);
}

export async function markNotificationRead(notificationId: number, userId: number) {
  const database = await requireDb();
  await database.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, notificationId), eq(notifications.recipientUserId, userId)));
  const result = await database.select().from(notifications).where(and(eq(notifications.id, notificationId), eq(notifications.recipientUserId, userId))).limit(1);
  return result[0] ?? null;
}

export async function listCoordinatorRecipients() {
  const database = await requireDb();
  return database.select().from(users).where(inArray(users.role, ["coordinator", "admin"]));
}

export async function listAvailableVolunteersNearIncident(incident: Incident) {
  const database = await requireDb();
  const candidates = await database.select().from(users).where(and(eq(users.role, "volunteer"), eq(users.profileStatus, "active"), eq(users.volunteerAvailability, "available")));
  return candidates.filter(candidate => candidate.verifiedAt && candidate.volunteerLatitudeE6 !== null && candidate.volunteerLongitudeE6 !== null && distanceMeters(candidate.volunteerLatitudeE6, candidate.volunteerLongitudeE6, incident.latitudeE6, incident.longitudeE6) <= 10_000);
}

export async function listSearchingIncidentsCreatedBefore(cutoff: Date) {
  const database = await requireDb();
  return database.select().from(incidents).where(and(eq(incidents.isDemo, false), eq(incidents.status, "searching"), isNull(incidents.assignedVolunteerId), lt(incidents.createdAt, cutoff))).orderBy(asc(incidents.createdAt)).limit(100);
}

export async function listEscalatedIncidentsBefore(cutoff: Date) {
  const database = await requireDb();
  return database.select().from(incidents).where(and(eq(incidents.isDemo, false), isNotNull(incidents.ghrEscalatedAt), lt(incidents.ghrEscalatedAt, cutoff), inArray(incidents.status, ["searching", "accepted", "en_route", "arrived", "assisting"]))).orderBy(asc(incidents.ghrEscalatedAt)).limit(100);
}

/** Development QA only: age an explicitly marked, unassigned searching fixture without touching live or Demo Mode records. */
export async function ageDevelopmentTimeoutFixture(publicId: string, kind: "responder_search" | "escalation") {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  if (incident.isDemo || !incident.locationLabel.startsWith("QA timeout fixture ·") || incident.status !== "searching" || incident.assignedVolunteerId !== null) {
    throw new Error("Only an unassigned QA timeout fixture in responder search can be aged.");
  }
  const database = await requireDb();
  const overdueAt = new Date(Date.now() - 24 * 60 * 60 * 1_000);
  if (kind === "escalation") {
    if (!incident.ghrEscalatedAt) throw new Error("Escalation timeout fixture must be escalated before it is aged.");
    await database.update(incidents).set({ ghrEscalatedAt: overdueAt, updatedAt: overdueAt }).where(eq(incidents.id, incident.id));
  } else {
    await database.update(incidents).set({ createdAt: overdueAt, updatedAt: overdueAt }).where(eq(incidents.id, incident.id));
  }
  return getIncidentByPublicId(publicId);
}

/** Development QA only: remove all artifacts for an explicitly marked fixture after controlled verification. */
export async function deleteDevelopmentTimeoutFixture(publicId: string) {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return false;
  if (incident.isDemo || !incident.locationLabel.startsWith("QA timeout fixture ·") || incident.assignedVolunteerId !== null) {
    throw new Error("Only an unassigned QA timeout fixture can be removed.");
  }
  const database = await requireDb();
  await database.delete(notifications).where(eq(notifications.incidentId, incident.id));
  await database.delete(aiAnalysisJobs).where(eq(aiAnalysisJobs.incidentId, incident.id));
  await database.delete(aiIncidentAudits).where(eq(aiIncidentAudits.incidentId, incident.id));
  await database.delete(incidentEvents).where(eq(incidentEvents.incidentId, incident.id));
  await database.delete(incidents).where(eq(incidents.id, incident.id));
  return true;
}

export async function getVolunteerReadiness(userId: number) {
  const user = await getUserById(userId);
  if (!user || user.role !== "volunteer") return null;
  return { profileStatus: user.profileStatus, availability: user.volunteerAvailability, verifiedAt: user.verifiedAt, latitudeE6: user.volunteerLatitudeE6, longitudeE6: user.volunteerLongitudeE6, locationUpdatedAt: user.volunteerLocationUpdatedAt };
}

export async function verifyVolunteer(userId: number) {
  const database = await requireDb();
  await database.update(users).set({ profileStatus: "active", verifiedAt: new Date(), volunteerAvailability: "offline" }).where(and(eq(users.id, userId), eq(users.role, "volunteer")));
  return getVolunteerReadiness(userId);
}

export async function setVolunteerAvailability(userId: number, input: { availability: VolunteerAvailability; latitudeE6?: number; longitudeE6?: number }) {
  const database = await requireDb();
  const update: Partial<typeof users.$inferInsert> = { volunteerAvailability: input.availability };
  if (input.latitudeE6 !== undefined && input.longitudeE6 !== undefined) { update.volunteerLatitudeE6 = input.latitudeE6; update.volunteerLongitudeE6 = input.longitudeE6; update.volunteerLocationUpdatedAt = new Date(); }
  await database.update(users).set(update).where(and(eq(users.id, userId), eq(users.role, "volunteer")));
  return getVolunteerReadiness(userId);
}

export async function markSignedIn(userId: number) {
  const database = await requireDb();
  await database.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function listUsersForAdmin() {
  const database = await requireDb();
  return database.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, profileStatus: users.profileStatus, createdAt: users.createdAt, updatedAt: users.updatedAt }).from(users).orderBy(desc(users.createdAt)).limit(200);
}

export async function getIncidentByPublicId(publicId: string) {
  const database = await requireDb();
  const result = await database.select().from(incidents).where(eq(incidents.publicId, publicId)).limit(1);
  return result[0] ?? null;
}

export async function getIncidentById(id: number) {
  const database = await requireDb();
  const result = await database.select().from(incidents).where(eq(incidents.id, id)).limit(1);
  return result[0] ?? null;
}

export type IncidentWithResponder = Incident & { responderName: string | null };
export type IncidentMapSnapshot = {
  incident: IncidentWithResponder;
  responder: { userId: number; name: string; latitude: number; longitude: number; updatedAt: Date | null } | null;
};

export async function getIncidentWithResponder(publicId: string): Promise<IncidentWithResponder | null> {
  const database = await requireDb();
  const row = await database.select({ incident: incidents, responderName: users.name }).from(incidents).leftJoin(users, eq(incidents.assignedVolunteerId, users.id)).where(eq(incidents.publicId, publicId)).limit(1);
  return row[0] ? { ...row[0].incident, responderName: row[0].responderName } : null;
}

export type GoldenHourIncident = IncidentWithResponder & { responderAvailability: VolunteerAvailability | null };

export async function getGoldenHourIncident(publicId: string): Promise<GoldenHourIncident | null> {
  const database = await requireDb();
  const row = await database.select({ incident: incidents, responderName: users.name, responderAvailability: users.volunteerAvailability }).from(incidents).leftJoin(users, eq(incidents.assignedVolunteerId, users.id)).where(eq(incidents.publicId, publicId)).limit(1);
  return row[0] ? { ...row[0].incident, responderName: row[0].responderName, responderAvailability: row[0].responderAvailability } : null;
}

export async function getIncidentMapSnapshot(publicId: string): Promise<IncidentMapSnapshot | null> {
  const incident = await getIncidentWithResponder(publicId);
  if (!incident) return null;
  const responder = incident.assignedVolunteerId && incident.responderName && incident.responderLatitudeE6 !== null && incident.responderLongitudeE6 !== null
    ? { userId: incident.assignedVolunteerId, name: incident.responderName, latitude: incident.responderLatitudeE6 / 1_000_000, longitude: incident.responderLongitudeE6 / 1_000_000, updatedAt: incident.responderLocationUpdatedAt }
    : null;
  return { incident, responder };
}

export async function listIncidentEvents(incidentId: number): Promise<IncidentEvent[]> {
  const database = await requireDb();
  return database.select().from(incidentEvents).where(eq(incidentEvents.incidentId, incidentId)).orderBy(asc(incidentEvents.createdAt), asc(incidentEvents.id));
}

export async function enqueueAiAnalysisJob(incidentId: number) {
  const database = await requireDb();
  const existing = await database.select().from(aiAnalysisJobs).where(eq(aiAnalysisJobs.incidentId, incidentId)).limit(1);
  if (existing[0]) return existing[0];
  await database.insert(aiAnalysisJobs).values({ incidentId, status: "pending" });
  const queued = await database.select().from(aiAnalysisJobs).where(eq(aiAnalysisJobs.incidentId, incidentId)).limit(1);
  if (!queued[0]) throw new Error("AI analysis queue entry was not persisted.");
  return queued[0];
}

export async function listPendingAiAnalysisJobs(limit = 10) {
  const database = await requireDb();
  return database.select().from(aiAnalysisJobs).where(eq(aiAnalysisJobs.status, "pending")).orderBy(asc(aiAnalysisJobs.scheduledAt), asc(aiAnalysisJobs.id)).limit(Math.min(Math.max(limit, 1), 25));
}

export async function claimAiAnalysisJob(id: number): Promise<AiAnalysisJob | null> {
  const database = await requireDb();
  const job = (await database.select().from(aiAnalysisJobs).where(eq(aiAnalysisJobs.id, id)).limit(1))[0];
  if (!job || job.status !== "pending") return null;
  await database.update(aiAnalysisJobs).set({ status: "processing", lockedAt: new Date(), attemptCount: job.attemptCount + 1 }).where(and(eq(aiAnalysisJobs.id, id), eq(aiAnalysisJobs.status, "pending")));
  const claimed = (await database.select().from(aiAnalysisJobs).where(eq(aiAnalysisJobs.id, id)).limit(1))[0];
  return claimed?.status === "processing" ? claimed : null;
}

export async function completeAiAnalysisJob(id: number) {
  const database = await requireDb();
  await database.update(aiAnalysisJobs).set({ status: "completed", completedAt: new Date(), lastErrorCode: null }).where(eq(aiAnalysisJobs.id, id));
}

export async function retryOrFailAiAnalysisJob(id: number, errorCode: string) {
  const database = await requireDb();
  const job = (await database.select().from(aiAnalysisJobs).where(eq(aiAnalysisJobs.id, id)).limit(1))[0];
  if (!job) return;
  await database.update(aiAnalysisJobs).set({ status: job.attemptCount >= 3 ? "failed" : "pending", lastErrorCode: errorCode.slice(0, 120), lockedAt: null, scheduledAt: new Date() }).where(eq(aiAnalysisJobs.id, id));
}

export async function addAiIncidentAudit(input: { incidentId: number | null; actorUserId?: number | null; operation: "incident_enrichment" | "coordinator_assistant"; status: "succeeded" | "failed" | "fallback"; modelIdentifier?: string | null; inputMetadata: string; outputJson?: string | null; confidencePercent?: number | null; failureCode?: string | null; durationMs: number }) {
  const database = await requireDb();
  await database.insert(aiIncidentAudits).values({ ...input, inputMetadata: input.inputMetadata.slice(0, 500), outputJson: input.outputJson?.slice(0, 6_000) ?? null, confidencePercent: input.confidencePercent ?? null, failureCode: input.failureCode?.slice(0, 120) ?? null, durationMs: Math.max(0, Math.round(input.durationMs)) });
}

export async function getLatestAiInsight(incidentId: number) {
  const database = await requireDb();
  const rows = await database.select().from(aiIncidentAudits).where(and(eq(aiIncidentAudits.incidentId, incidentId), eq(aiIncidentAudits.operation, "incident_enrichment"))).orderBy(desc(aiIncidentAudits.createdAt), desc(aiIncidentAudits.id)).limit(1);
  return rows[0] ?? null;
}

export async function getAiAnalysisJobForIncident(incidentId: number) {
  const database = await requireDb();
  const rows = await database.select().from(aiAnalysisJobs).where(eq(aiAnalysisJobs.incidentId, incidentId)).limit(1);
  return rows[0] ?? null;
}

export async function listAiAudits(limit = 100) {
  const database = await requireDb();
  return database.select({ audit: aiIncidentAudits, publicId: incidents.publicId }).from(aiIncidentAudits).leftJoin(incidents, eq(aiIncidentAudits.incidentId, incidents.id)).orderBy(desc(aiIncidentAudits.createdAt), desc(aiIncidentAudits.id)).limit(Math.min(Math.max(limit, 1), 200));
}

export async function getResponderRecommendationsForIncident(incident: Incident, requiredSkills: ResponderType[]) {
  const database = await requireDb();
  const responders = await database.select().from(users).where(eq(users.role, "volunteer")).limit(200);
  return scoreResponders(responders.flatMap(responder => {
    if (responder.profileStatus !== "active" || responder.volunteerAvailability !== "available" || !responder.verifiedAt || responder.volunteerLatitudeE6 === null || responder.volunteerLongitudeE6 === null) return [];
    return [{ userId: responder.id, name: responder.name, distanceMeters: distanceMeters(responder.volunteerLatitudeE6, responder.volunteerLongitudeE6, incident.latitudeE6, incident.longitudeE6), availability: responder.volunteerAvailability, verified: true, skills: parseResponderSkills(responder.volunteerSkills) }];
  }), requiredSkills).filter(responder => responder.distanceMeters <= 10_000).slice(0, 5);
}

export async function setVolunteerSkills(userId: number, skills: string[]) {
  const database = await requireDb();
  const normalized = skills.filter(skill => typeof skill === "string").map(skill => skill.slice(0, 40)).slice(0, 10);
  await database.update(users).set({ volunteerSkills: JSON.stringify(normalized) }).where(and(eq(users.id, userId), eq(users.role, "volunteer")));
}

async function addIncidentEvent(input: { incidentId: number; actorUserId: number | null; eventType: IncidentEvent["eventType"]; note: string }) {
  const database = await requireDb();
  try {
    await database.insert(incidentEvents).values(input);
  } catch (firstError) {
    await new Promise(resolve => setTimeout(resolve, 40));
    try {
      await database.insert(incidentEvents).values(input);
    } catch (secondError) {
      console.warn("[Incident events] Audit insert retry failed:", firstError instanceof Error ? firstError.message : firstError);
      throw secondError;
    }
  }
}

function ensureGoldenHourActive(incident: Incident) {
  if (!isGoldenHourActive(incident)) throw new Error("Golden Hour Response is closed for this incident.");
}

export async function updateGoldenHourSeverity(publicId: string, actorUserId: number, severity: GhrSeverity) {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  ensureGoldenHourActive(incident);
  const database = await requireDb();
  await database.update(incidents).set({ ghrSeverity: severity }).where(eq(incidents.id, incident.id));
  await addIncidentEvent({ incidentId: incident.id, actorUserId, eventType: "severity_assessed", note: `Operational severity set to ${severity.replace("_", " ")}.` });
  return getGoldenHourIncident(publicId);
}

export async function selectGoldenHourFacility(publicId: string, actorUserId: number, input: { name: string; placeId: string | null; latitudeE6: number; longitudeE6: number; distanceMeters: number | null; etaMinutes: number | null }) {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  ensureGoldenHourActive(incident);
  const database = await requireDb();
  await database.update(incidents).set({
    ghrFacilityName: input.name,
    ghrFacilityPlaceId: input.placeId,
    ghrFacilityLatitudeE6: input.latitudeE6,
    ghrFacilityLongitudeE6: input.longitudeE6,
    ghrFacilityDistanceMeters: input.distanceMeters,
    ghrFacilityEtaMinutes: input.etaMinutes,
    ghrFacilitySelectedAt: new Date(),
  }).where(eq(incidents.id, incident.id));
  await addIncidentEvent({ incidentId: incident.id, actorUserId, eventType: "facility_selected", note: `Appropriate care facility selected: ${input.name}.` });
  return getGoldenHourIncident(publicId);
}

export async function updateGoldenHourEscalation(publicId: string, actorUserId: number, input: { escalation: Exclude<GhrEscalation, "not_escalated">; note: string | null }) {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  ensureGoldenHourActive(incident);
  const database = await requireDb();
  await database.update(incidents).set({ ghrEscalation: input.escalation, ghrEscalationNote: input.note, ghrEscalatedAt: new Date() }).where(eq(incidents.id, incident.id));
  await addIncidentEvent({ incidentId: incident.id, actorUserId, eventType: "escalated", note: `Golden Hour Response escalation: ${input.escalation.replaceAll("_", " ")}.${input.note ? ` ${input.note}` : ""}` });
  return getGoldenHourIncident(publicId);
}

export async function resolveGoldenHourIncident(publicId: string, actorUserId: number) {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  if (!canCloseGoldenHourResponse(incident)) throw new Error("Golden Hour resolution is available after the responder has arrived or assistance has started.");
  const resolved = await transitionIncident({ incident, to: "resolved", actorUserId, note: "Golden Hour Response resolved by operations coordination." });
  if (incident.assignedVolunteerId) await setVolunteerAvailability(incident.assignedVolunteerId, { availability: "offline" });
  return resolved;
}

export async function createIncident(input: { publicId: string; createdByUserId: number; emergencyType: EmergencyType; locationLabel: string; latitudeE6: number; longitudeE6: number; accuracyMeters: number; description: string | null }) {
  const database = await requireDb();
  await database.insert(incidents).values({ ...input, status: "searching" });
  const created = await getIncidentByPublicId(input.publicId);
  if (!created) throw new Error("Incident creation did not return an incident");
  await addIncidentEvent({ incidentId: created.id, actorUserId: input.createdByUserId, eventType: "created", note: "Emergency request confirmed." });
  await addIncidentEvent({ incidentId: created.id, actorUserId: null, eventType: "search_started", note: "Searching verified nearby responders." });
  enqueueAiAnalysisJob(created.id).catch(error => console.warn("[AI queue] Incident enrichment was not queued:", error instanceof Error ? error.message : error));
  return created;
}

async function transitionIncident(input: { incident: Incident; to: ManagedIncidentStatus; actorUserId: number | null; note: string; responderEtaMinutes?: number | null }) {
  if (!canTransition(input.incident.status, input.to)) throw new Error(`Invalid incident transition from ${input.incident.status} to ${input.to}`);
  const database = await requireDb();
  const now = new Date();
  const update: Partial<typeof incidents.$inferInsert> = { status: input.to };
  if (input.to === "accepted") { update.acceptedAt = now; update.responderEtaMinutes = input.responderEtaMinutes ?? 8; }
  if (input.to === "arrived") update.arrivedAt = now;
  if (input.to === "resolved") update.resolvedAt = now;
  await database.update(incidents).set(update).where(eq(incidents.id, input.incident.id));
  await addIncidentEvent({ incidentId: input.incident.id, actorUserId: input.actorUserId, eventType: lifecycleEventFor(input.to), note: input.note });
  const refreshed = await getIncidentByPublicId(input.incident.publicId);
  if (!refreshed) throw new Error("Incident transition did not return an incident");
  return refreshed;
}

export async function acceptIncident(publicId: string, volunteerUserId: number) {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  if (incident.status !== "searching" || incident.assignedVolunteerId) throw new Error("This incident is no longer available for acceptance.");
  const database = await requireDb();
  await database.update(incidents).set({ assignedVolunteerId: volunteerUserId, responderLatitudeE6: incident.latitudeE6 + 18_000, responderLongitudeE6: incident.longitudeE6 - 12_000, responderLocationUpdatedAt: new Date() }).where(and(eq(incidents.id, incident.id), eq(incidents.status, "searching"), isNull(incidents.assignedVolunteerId)));
  const refreshed = await getIncidentByPublicId(publicId);
  if (!refreshed) throw new Error("Responder assignment did not return an incident");
  if (refreshed.assignedVolunteerId !== volunteerUserId) throw new Error("This incident was accepted by another responder.");
  return transitionIncident({ incident: refreshed, to: "accepted", actorUserId: volunteerUserId, note: "A verified responder accepted your request.", responderEtaMinutes: 8 });
}

export async function updateResponderPosition(publicId: string, volunteerUserId: number, latitudeE6: number, longitudeE6: number) {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  if (incident.assignedVolunteerId !== volunteerUserId) throw new Error("Only the assigned responder can update this map position.");
  const database = await requireDb();
  await database.update(incidents).set({ responderLatitudeE6: latitudeE6, responderLongitudeE6: longitudeE6, responderLocationUpdatedAt: new Date() }).where(eq(incidents.id, incident.id));
  return getIncidentByPublicId(publicId);
}

export async function volunteerAdvance(publicId: string, volunteerUserId: number, to: Extract<ManagedIncidentStatus, "en_route" | "arrived">) {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  if (incident.assignedVolunteerId !== volunteerUserId) throw new Error("Only the assigned responder can update this incident.");
  return transitionIncident({ incident, to, actorUserId: volunteerUserId, note: to === "en_route" ? "Your responder is on the way." : "Your responder has arrived." });
}

export async function volunteerBeginAssistance(publicId: string, volunteerUserId: number) {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  if (incident.assignedVolunteerId !== volunteerUserId) throw new Error("Only the assigned responder can begin assistance.");
  const transitioned = await transitionIncident({ incident, to: "assisting", actorUserId: volunteerUserId, note: "Your responder has started providing assistance." });
  const database = await requireDb();
  await database.update(incidents).set({ assistanceStartedAt: new Date() }).where(eq(incidents.id, transitioned.id));
  return getIncidentByPublicId(publicId);
}

export async function resolveIncidentByVolunteer(publicId: string, volunteerUserId: number) {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  if (incident.assignedVolunteerId !== volunteerUserId) throw new Error("Only the assigned responder can resolve this incident.");
  return transitionIncident({ incident, to: "resolved", actorUserId: volunteerUserId, note: "Incident resolved by the assigned responder after assistance." });
}

export async function resolveIncident(publicId: string, citizenUserId: number) {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  if (incident.createdByUserId !== citizenUserId) throw new Error("Only the requesting citizen can resolve this incident.");
  return transitionIncident({ incident, to: "resolved", actorUserId: citizenUserId, note: "Incident marked resolved by the requesting citizen." });
}

export async function advanceDevelopmentSimulation(publicId: string, citizenUserId: number) {
  if (process.env.NODE_ENV === "production") throw new Error("Development responder simulation is disabled in production.");
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  if (incident.createdByUserId !== citizenUserId) throw new Error("Only the requesting citizen can simulate this incident.");
  if (incident.status === "searching") {
    const demoVolunteer = await getUserByEmail("volunteer.demo@raneev.test");
    if (!demoVolunteer || demoVolunteer.role !== "volunteer") throw new Error("Development responder account is unavailable.");
    return acceptIncident(publicId, demoVolunteer.id);
  }
  if (!incident.assignedVolunteerId) throw new Error("No responder is assigned to this incident.");
  if (incident.status === "accepted") return volunteerAdvance(publicId, incident.assignedVolunteerId, "en_route");
  if (incident.status === "en_route") return volunteerAdvance(publicId, incident.assignedVolunteerId, "arrived");
  if (incident.status === "arrived") return resolveIncident(publicId, citizenUserId);
  throw new Error("This incident has reached the end of the development simulation.");
}

export async function advanceDevelopmentResponderMovement(publicId: string, citizenUserId: number) {
  if (process.env.NODE_ENV === "production") throw new Error("Development responder movement is disabled in production.");
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  if (incident.createdByUserId !== citizenUserId) throw new Error("Only the requesting citizen can simulate this responder movement.");
  if (!incident.assignedVolunteerId || !["accepted", "en_route"].includes(incident.status)) throw new Error("A responder must be accepted or en route before movement can be simulated.");
  const startLat = incident.responderLatitudeE6 ?? incident.latitudeE6 + 18_000;
  const startLng = incident.responderLongitudeE6 ?? incident.longitudeE6 - 12_000;
  const latitudeE6 = Math.round(startLat + (incident.latitudeE6 - startLat) * 0.42);
  const longitudeE6 = Math.round(startLng + (incident.longitudeE6 - startLng) * 0.42);
  const database = await requireDb();
  await database.update(incidents).set({ responderLatitudeE6: latitudeE6, responderLongitudeE6: longitudeE6, responderLocationUpdatedAt: new Date(), responderEtaMinutes: Math.max(1, (incident.responderEtaMinutes ?? 8) - 2) }).where(eq(incidents.id, incident.id));
  return getIncidentByPublicId(publicId);
}

export async function getActiveIncidentForCitizen(citizenUserId: number) {
  const database = await requireDb();
  const active = await database.select().from(incidents).where(eq(incidents.createdByUserId, citizenUserId)).orderBy(desc(incidents.updatedAt)).limit(20);
  const current = active.find(incident => !["resolved", "cancelled"].includes(incident.status));
  return current ? getIncidentWithResponder(current.publicId) : null;
}

export async function getActiveIncidentForVolunteer(volunteerUserId: number) {
  const database = await requireDb();
  const active = await database.select().from(incidents).where(eq(incidents.assignedVolunteerId, volunteerUserId)).orderBy(desc(incidents.updatedAt)).limit(20);
  const current = active.find(incident => !["resolved", "cancelled"].includes(incident.status));
  return current ? getIncidentWithResponder(current.publicId) : null;
}

function distanceMeters(aLatE6: number, aLngE6: number, bLatE6: number, bLngE6: number) {
  const radius = 6_371_000;
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians((bLatE6 - aLatE6) / 1_000_000);
  const dLng = radians((bLngE6 - aLngE6) / 1_000_000);
  const lat1 = radians(aLatE6 / 1_000_000);
  const lat2 = radians(bLatE6 / 1_000_000);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export async function listNearbyOpenIncidents(volunteerUserId: number, demoOnly = false) {
  const volunteer = await getUserById(volunteerUserId);
  if (!volunteer || volunteer.role !== "volunteer" || volunteer.volunteerLatitudeE6 === null || volunteer.volunteerLongitudeE6 === null) return [];
  const database = await requireDb();
  const open = await database.select().from(incidents).where(and(eq(incidents.status, "searching"), isNull(incidents.assignedVolunteerId), eq(incidents.isDemo, demoOnly))).orderBy(desc(incidents.createdAt)).limit(100);
  return open.map(incident => ({ ...incident, distanceMeters: distanceMeters(volunteer.volunteerLatitudeE6!, volunteer.volunteerLongitudeE6!, incident.latitudeE6, incident.longitudeE6) })).filter(incident => incident.distanceMeters <= 10_000).sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export async function listIncidentsVisibleTo(user: User, demoOnly = false): Promise<Incident[]> {
  const database = await requireDb();
  const demoCondition = eq(incidents.isDemo, demoOnly);
  if (user.role === "admin" || user.role === "coordinator") return database.select().from(incidents).where(demoCondition).orderBy(desc(incidents.updatedAt)).limit(200);
  if (user.role === "citizen") return database.select().from(incidents).where(and(eq(incidents.createdByUserId, user.id), demoCondition)).orderBy(desc(incidents.updatedAt)).limit(100);
  return database.select().from(incidents).where(and(eq(incidents.assignedVolunteerId, user.id), demoCondition)).orderBy(desc(incidents.updatedAt)).limit(100);
}

export async function getCoordinatorCommandCenter(demoOnly = false) {
  const database = await requireDb();
  const incidentRows = await database.select({ incident: incidents, responderName: users.name, responderAvailability: users.volunteerAvailability }).from(incidents).leftJoin(users, eq(incidents.assignedVolunteerId, users.id)).where(eq(incidents.isDemo, demoOnly)).orderBy(desc(incidents.updatedAt)).limit(200);
  const responderRows = await database.select({ id: users.id, name: users.name, profileStatus: users.profileStatus, availability: users.volunteerAvailability, latitudeE6: users.volunteerLatitudeE6, longitudeE6: users.volunteerLongitudeE6, locationUpdatedAt: users.volunteerLocationUpdatedAt }).from(users).where(eq(users.role, "volunteer")).orderBy(desc(users.volunteerLocationUpdatedAt)).limit(200);
  const allIncidents = incidentRows.map(row => ({ ...row.incident, responderName: row.responderName, responderAvailability: row.responderAvailability }));
  const activeIncidents = allIncidents.filter(incident => !["resolved", "cancelled"].includes(incident.status)).sort((left, right) => coordinatorPriority(right.status, right.ghrSeverity) - coordinatorPriority(left.status, left.ghrSeverity) || right.updatedAt.getTime() - left.updatedAt.getTime());
  const activeIds = new Set(activeIncidents.map(incident => incident.id));
  const eventRows = await database.select({ event: incidentEvents, publicId: incidents.publicId, emergencyType: incidents.emergencyType }).from(incidentEvents).innerJoin(incidents, eq(incidentEvents.incidentId, incidents.id)).orderBy(desc(incidentEvents.createdAt), desc(incidentEvents.id)).limit(100);
  const timeline = eventRows.filter(row => activeIds.has(row.event.incidentId)).slice(0, 20).map(row => ({ ...row.event, publicId: row.publicId, emergencyType: row.emergencyType }));
  return {
    metrics: {
      activeEmergencies: activeIncidents.length,
      availableResponders: responderRows.filter(responder => responder.profileStatus === "active" && responder.availability === "available").length,
      averageAcceptanceMinutes: averageAcceptanceMinutes(allIncidents),
    },
    activeIncidents: activeIncidents.slice(0, 20),
    responders: responderRows,
    timeline,
  };
}
