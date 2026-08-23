/* RANEEV controlled Demo Mode actors — clearly fictional accounts used only by the presenter simulation. */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AppRole } from "../drizzle/schema";
import { users } from "../drizzle/schema";
import * as db from "./db";
import { hashPassword } from "./auth/credentials";

export const DEMO_ACCOUNTS = [
  { name: "Demo Citizen", email: "citizen.demo@raneev.test", phone: "+91 90000 01001", role: "citizen" as AppRole, password: "Raneev!Citizen26" },
  { name: "Arjun Kumar — Demo Responder", email: "volunteer.demo@raneev.test", phone: "+91 90000 01002", role: "volunteer" as AppRole, password: "Raneev!Volunteer26" },
  { name: "Demo Coordinator", email: "coordinator.demo@raneev.test", phone: "+91 90000 01003", role: "coordinator" as AppRole, password: "Raneev!Coord26" },
  { name: "Demo Administrator", email: "admin.demo@raneev.test", phone: "+91 90000 01004", role: "admin" as AppRole, password: "Raneev!Admin26" },
];

export async function ensureDevelopmentDemoAccounts() {
  for (const account of DEMO_ACCOUNTS) {
    const existing = await db.getUserByEmail(account.email);
    if (existing) {
      if (existing.name !== account.name || (account.role === "volunteer" && (!existing.verifiedAt || existing.profileStatus !== "active"))) {
        const database = await db.getDb();
        if (database) await database.update(users).set({ name: account.name, profileStatus: account.role === "volunteer" ? "active" : existing.profileStatus, verifiedAt: account.role === "volunteer" ? (existing.verifiedAt ?? new Date()) : existing.verifiedAt }).where(eq(users.id, existing.id));
      }
      continue;
    }
    await db.createCredentialUser({
      openId: `credential:${randomUUID()}`,
      name: account.name,
      email: account.email,
      phone: account.phone,
      passwordHash: await hashPassword(account.password),
      role: account.role,
      profileStatus: "active",
    });
  }
  const demoVolunteer = await db.getUserByEmail("volunteer.demo@raneev.test");
  if (demoVolunteer) await db.setVolunteerSkills(demoVolunteer.id, ["medical", "general_response"]);
}
