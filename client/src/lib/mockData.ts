/* RANEEV Clinical Wayfinding — UI-only presentation data: realistic operational context without backend behavior. */
export type EmergencyTone = "critical" | "warning" | "safe" | "info" | "neutral";

export const assets = {
  logo: "/manus-storage/raneev-response-compass_243f3c6f.png",
  mapHero: "/manus-storage/raneev-command-map-hero_397f7d22.jpg",
  responder: "/manus-storage/raneev-responder-field_1e9e7b28.jpg",
  texture: "/manus-storage/raneev-route-texture_16f79ab9.jpg",
};

export const demoIncident = {
  id: "ERN-2408-184",
  category: "Road accident",
  location: "NH 44 service road, Devanahalli",
  createdAt: "11:42",
  status: "Responder en route",
  eta: "06 min",
  responder: "Ananya Rao",
  distance: "2.4 km",
};

export const incidents = [
  { id: "ERN-2408-184", title: "Road accident", location: "NH 44 service road", time: "11:42", status: "Responder en route", tone: "critical" as EmergencyTone, responder: "Ananya Rao" },
  { id: "GHR-2408-061", title: "Unconscious person", location: "Kogilu main road", time: "11:36", status: "Matching responders", tone: "warning" as EmergencyTone, responder: "Awaiting acceptance" },
  { id: "ERN-2408-177", title: "Injury assistance", location: "Sahakara Nagar", time: "10:58", status: "Resolved", tone: "safe" as EmergencyTone, responder: "Rahul S." },
];

export const responders = [
  { name: "Ananya Rao", skill: "First aid · CPR", range: "2.4 km", status: "En route", tone: "critical" as EmergencyTone, initials: "AR" },
  { name: "Kiran Shah", skill: "Basic rescue", range: "3.1 km", status: "Available", tone: "safe" as EmergencyTone, initials: "KS" },
  { name: "Dr. Meera N.", skill: "Medical support", range: "5.6 km", status: "Busy", tone: "warning" as EmergencyTone, initials: "MN" },
];

export const auditEvents = [
  { time: "11:42:10", action: "Incident created", actor: "Citizen request", detail: "ERN-2408-184" },
  { time: "11:42:12", action: "Candidate search started", actor: "Matching service", detail: "Search band 0–3 km" },
  { time: "11:42:21", action: "Responder alerted", actor: "Notification service", detail: "Ananya Rao" },
  { time: "11:43:08", action: "Assignment accepted", actor: "Ananya Rao", detail: "Primary responder" },
];

export const navByRole = {
  citizen: [
    ["Home", "/citizen"], ["Report emergency", "/citizen/report"], ["Live incident", "/citizen/live"], ["History", "/citizen/history"], ["Profile", "/citizen/profile"],
  ],
  volunteer: [
    ["Dashboard", "/volunteer"], ["Availability", "/volunteer/availability"], ["Nearby emergency", "/volunteer/nearby"], ["Active response", "/volunteer/active"], ["Response history", "/volunteer/history"], ["Verification", "/volunteer/profile"],
  ],
  coordinator: [
    ["Command center", "/coordinator"], ["Incident list", "/coordinator/incidents"], ["Incident details", "/coordinator/details"], ["Live map", "/coordinator/map"], ["Responders", "/coordinator/responders"], ["Analytics", "/coordinator/analytics"],
  ],
  admin: [
    ["Admin dashboard", "/admin"], ["User management", "/admin/users"], ["Volunteer verification", "/admin/verification"], ["Incident management", "/admin/incidents"], ["Audit logs", "/admin/audit"],
  ],
} as const;
