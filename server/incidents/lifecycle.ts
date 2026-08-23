/* RANEEV incident lifecycle — one shared transition policy for every server procedure. */
import type { Incident, IncidentEventType } from "../../drizzle/schema";

export type ManagedIncidentStatus = Extract<Incident["status"], "searching" | "accepted" | "en_route" | "arrived" | "assisting" | "resolved">;

const transitions: Record<ManagedIncidentStatus, readonly ManagedIncidentStatus[]> = {
  searching: ["accepted"],
  accepted: ["en_route"],
  en_route: ["arrived"],
  arrived: ["assisting", "resolved"],
  assisting: ["resolved"],
  resolved: [],
};

const eventForStatus: Record<ManagedIncidentStatus, IncidentEventType> = {
  searching: "search_started",
  accepted: "responder_accepted",
  en_route: "en_route",
  arrived: "arrived",
  assisting: "assistance_started",
  resolved: "resolved",
};

export function canTransition(from: Incident["status"], to: ManagedIncidentStatus) {
  return from in transitions && transitions[from as ManagedIncidentStatus].includes(to);
}

export function lifecycleEventFor(status: ManagedIncidentStatus) {
  return eventForStatus[status];
}
