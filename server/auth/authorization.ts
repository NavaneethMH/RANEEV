/* RANEEV authorization — role and ownership decisions are enforced server-side before protected data is returned. */
import type { AppRole, Incident, User } from "../../drizzle/schema";

export function hasRole(user: User, roles: readonly AppRole[]) {
  return roles.includes(user.role);
}

export function canReadIncident(user: User, incident: Incident) {
  if (user.role === "admin" || user.role === "coordinator") return true;
  if (user.role === "citizen") return incident.createdByUserId === user.id;
  return incident.assignedVolunteerId === user.id;
}

export function canModifyResponderAssignment(user: User) {
  return user.role === "coordinator" || user.role === "admin";
}

export function canChangeRole(actor: User, targetUserId: number) {
  return actor.role === "admin" && actor.id !== targetUserId;
}
