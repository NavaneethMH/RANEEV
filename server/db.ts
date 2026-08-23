/* RANEEV database access — all credential and incident queries return the minimum fields needed for server authorization. */
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { AppRole, EmergencyType, GhrEscalation, GhrSeverity, Incident, IncidentEvent, InsertUser, User, VolunteerAvailability } from "../drizzle/schema";
import { incidentEvents, incidents, users } from "../drizzle/schema";
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

async function addIncidentEvent(input: { incidentId: number; actorUserId: number | null; eventType: IncidentEvent["eventType"]; note: string }) {
  const database = await requireDb();
  await database.insert(incidentEvents).values(input);
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

export async function listNearbyOpenIncidents(volunteerUserId: number) {
  const volunteer = await getUserById(volunteerUserId);
  if (!volunteer || volunteer.role !== "volunteer" || volunteer.volunteerLatitudeE6 === null || volunteer.volunteerLongitudeE6 === null) return [];
  const database = await requireDb();
  const open = await database.select().from(incidents).where(and(eq(incidents.status, "searching"), isNull(incidents.assignedVolunteerId))).orderBy(desc(incidents.createdAt)).limit(100);
  return open.map(incident => ({ ...incident, distanceMeters: distanceMeters(volunteer.volunteerLatitudeE6!, volunteer.volunteerLongitudeE6!, incident.latitudeE6, incident.longitudeE6) })).filter(incident => incident.distanceMeters <= 10_000).sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export async function listIncidentsVisibleTo(user: User): Promise<Incident[]> {
  const database = await requireDb();
  if (user.role === "admin" || user.role === "coordinator") return database.select().from(incidents).orderBy(desc(incidents.updatedAt)).limit(200);
  if (user.role === "citizen") return database.select().from(incidents).where(eq(incidents.createdByUserId, user.id)).orderBy(desc(incidents.updatedAt)).limit(100);
  return database.select().from(incidents).where(eq(incidents.assignedVolunteerId, user.id)).orderBy(desc(incidents.updatedAt)).limit(100);
}

export async function getCoordinatorCommandCenter() {
  const database = await requireDb();
  const incidentRows = await database.select({ incident: incidents, responderName: users.name, responderAvailability: users.volunteerAvailability }).from(incidents).leftJoin(users, eq(incidents.assignedVolunteerId, users.id)).orderBy(desc(incidents.updatedAt)).limit(200);
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
