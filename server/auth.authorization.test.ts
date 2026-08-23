/* RANEEV authorization tests — prove role escalation and private incident access are rejected on the server. */
import { describe, expect, it } from "vitest";
import type { Incident, User } from "../drizzle/schema";
import { canChangeRole, canReadIncident, hasRole } from "./auth/authorization";

const baseUser = { id: 1, openId: "credential:test", name: "Test", email: "test@raneev.test", phone: null, passwordHash: "hash", loginMethod: "credentials", profileStatus: "active", sessionVersion: 1, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as const;
const incident = { id: 1, publicId: "ERN-TEST-001", createdByUserId: 1, assignedVolunteerId: 2, status: "active", createdAt: new Date(), updatedAt: new Date() } as Incident;
const asUser = (role: User["role"], id = 1) => ({ ...baseUser, id, role } as User);

describe("RANEEV server authorization", () => {
  it("restricts citizen incident visibility to incident ownership", () => { expect(canReadIncident(asUser("citizen", 1), incident)).toBe(true); expect(canReadIncident(asUser("citizen", 9), incident)).toBe(false); });
  it("restricts volunteer incident visibility to the assigned responder", () => { expect(canReadIncident(asUser("volunteer", 2), incident)).toBe(true); expect(canReadIncident(asUser("volunteer", 3), incident)).toBe(false); });
  it("allows coordinators and administrators to read operational incidents", () => { expect(canReadIncident(asUser("coordinator", 5), incident)).toBe(true); expect(canReadIncident(asUser("admin", 6), incident)).toBe(true); });
  it("prevents role changes by non-admins and self-demotion by an active administrator", () => { expect(canChangeRole(asUser("citizen"), 2)).toBe(false); expect(canChangeRole(asUser("admin", 1), 1)).toBe(false); expect(canChangeRole(asUser("admin", 1), 2)).toBe(true); });
  it("matches only explicit roles", () => { expect(hasRole(asUser("volunteer"), ["volunteer"])).toBe(true); expect(hasRole(asUser("volunteer"), ["coordinator", "admin"])).toBe(false); });
});
