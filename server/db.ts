/* RANEEV database access — all credential and incident queries return the minimum fields needed for server authorization. */
import { asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { AppRole, EmergencyType, Incident, IncidentEvent, InsertUser, User } from "../drizzle/schema";
import { incidentEvents, incidents, users } from "../drizzle/schema";
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

export async function getIncidentWithResponder(publicId: string): Promise<IncidentWithResponder | null> {
  const database = await requireDb();
  const row = await database.select({ incident: incidents, responderName: users.name }).from(incidents).leftJoin(users, eq(incidents.assignedVolunteerId, users.id)).where(eq(incidents.publicId, publicId)).limit(1);
  return row[0] ? { ...row[0].incident, responderName: row[0].responderName } : null;
}

export async function listIncidentEvents(incidentId: number): Promise<IncidentEvent[]> {
  const database = await requireDb();
  return database.select().from(incidentEvents).where(eq(incidentEvents.incidentId, incidentId)).orderBy(asc(incidentEvents.createdAt), asc(incidentEvents.id));
}

async function addIncidentEvent(input: { incidentId: number; actorUserId: number | null; eventType: IncidentEvent["eventType"]; note: string }) {
  const database = await requireDb();
  await database.insert(incidentEvents).values(input);
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
  await database.update(incidents).set({ assignedVolunteerId: volunteerUserId }).where(eq(incidents.id, incident.id));
  const refreshed = await getIncidentByPublicId(publicId);
  if (!refreshed) throw new Error("Responder assignment did not return an incident");
  return transitionIncident({ incident: refreshed, to: "accepted", actorUserId: volunteerUserId, note: "A verified responder accepted your request.", responderEtaMinutes: 8 });
}

export async function volunteerAdvance(publicId: string, volunteerUserId: number, to: Extract<ManagedIncidentStatus, "en_route" | "arrived">) {
  const incident = await getIncidentByPublicId(publicId);
  if (!incident) return null;
  if (incident.assignedVolunteerId !== volunteerUserId) throw new Error("Only the assigned responder can update this incident.");
  return transitionIncident({ incident, to, actorUserId: volunteerUserId, note: to === "en_route" ? "Your responder is on the way." : "Your responder has arrived." });
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

export async function getActiveIncidentForCitizen(citizenUserId: number) {
  const database = await requireDb();
  const active = await database.select().from(incidents).where(eq(incidents.createdByUserId, citizenUserId)).orderBy(desc(incidents.updatedAt)).limit(20);
  const current = active.find(incident => !["resolved", "cancelled"].includes(incident.status));
  return current ? getIncidentWithResponder(current.publicId) : null;
}

export async function listIncidentsVisibleTo(user: User): Promise<Incident[]> {
  const database = await requireDb();
  if (user.role === "admin" || user.role === "coordinator") return database.select().from(incidents).orderBy(desc(incidents.updatedAt)).limit(200);
  if (user.role === "citizen") return database.select().from(incidents).where(eq(incidents.createdByUserId, user.id)).orderBy(desc(incidents.updatedAt)).limit(100);
  return database.select().from(incidents).where(eq(incidents.assignedVolunteerId, user.id)).orderBy(desc(incidents.updatedAt)).limit(100);
}
