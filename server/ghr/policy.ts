import type { GhrEscalation, GhrSeverity, Incident } from "../../drizzle/schema";

export const ghrSeverityLabels: Record<GhrSeverity, string> = {
  unassessed: "Unassessed",
  standard: "Standard priority",
  urgent: "Urgent priority",
  critical: "Critical priority",
};

export const ghrEscalationLabels: Record<GhrEscalation, string> = {
  not_escalated: "Not escalated",
  monitoring: "Monitoring",
  facility_contacted: "Facility contacted",
  professional_services_contacted: "Professional services contacted",
};

export function canCloseGoldenHourResponse(incident: Incident) {
  return incident.status === "arrived" || incident.status === "assisting";
}

export function isGoldenHourActive(incident: Incident) {
  return !["resolved", "cancelled"].includes(incident.status);
}
