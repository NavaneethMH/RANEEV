/* RANEEV development fixture — creates clearly fake local/demo accounts only outside production. */
import { randomUUID } from "node:crypto";
import type { AppRole } from "../drizzle/schema";
import * as db from "./db";
import { hashPassword } from "./auth/credentials";

export const DEMO_ACCOUNTS = [
  { name: "Demo Citizen", email: "citizen.demo@raneev.test", phone: "+91 90000 01001", role: "citizen" as AppRole, password: "Raneev!Citizen26" },
  { name: "Demo Volunteer", email: "volunteer.demo@raneev.test", phone: "+91 90000 01002", role: "volunteer" as AppRole, password: "Raneev!Volunteer26" },
  { name: "Demo Coordinator", email: "coordinator.demo@raneev.test", phone: "+91 90000 01003", role: "coordinator" as AppRole, password: "Raneev!Coord26" },
  { name: "Demo Administrator", email: "admin.demo@raneev.test", phone: "+91 90000 01004", role: "admin" as AppRole, password: "Raneev!Admin26" },
];

export async function ensureDevelopmentDemoAccounts() {
  if (process.env.NODE_ENV === "production") return;
  for (const account of DEMO_ACCOUNTS) {
    const existing = await db.getUserByEmail(account.email);
    if (existing) continue;
    await db.createCredentialUser({
      openId: `credential:${randomUUID()}`,
      name: account.name,
      email: account.email,
      phone: account.phone,
      passwordHash: await hashPassword(account.password),
      role: account.role,
      profileStatus: account.role === "volunteer" ? "pending_verification" : "active",
    });
  }
  const demoVolunteer = await db.getUserByEmail("volunteer.demo@raneev.test");
  if (demoVolunteer && demoVolunteer.volunteerSkills === "[]") await db.setVolunteerSkills(demoVolunteer.id, ["medical", "general_response"]);
}
