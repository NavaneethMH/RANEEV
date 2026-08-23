/* RANEEV database access — all credential and incident queries return the minimum fields needed for server authorization. */
import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { AppRole, Incident, InsertUser, User } from "../drizzle/schema";
import { incidents, users } from "../drizzle/schema";

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

export async function createIncident(input: { publicId: string; createdByUserId: number }) {
  const database = await requireDb();
  await database.insert(incidents).values({ publicId: input.publicId, createdByUserId: input.createdByUserId, status: "active" });
  const created = await getIncidentByPublicId(input.publicId);
  if (!created) throw new Error("Incident creation did not return an incident");
  return created;
}

export async function listIncidentsVisibleTo(user: User): Promise<Incident[]> {
  const database = await requireDb();
  if (user.role === "admin" || user.role === "coordinator") return database.select().from(incidents).orderBy(desc(incidents.updatedAt)).limit(200);
  if (user.role === "citizen") return database.select().from(incidents).where(eq(incidents.createdByUserId, user.id)).orderBy(desc(incidents.updatedAt)).limit(100);
  return database.select().from(incidents).where(eq(incidents.assignedVolunteerId, user.id)).orderBy(desc(incidents.updatedAt)).limit(100);
}
