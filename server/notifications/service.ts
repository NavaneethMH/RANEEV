import type { DemoStage, Incident, NotificationPriority, NotificationType, User } from "../../drizzle/schema";
import * as db from "../db";
import { getNotificationConfig } from "./config";

type Notice = {
  key: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
};

type IncidentEvent = "created" | "accepted" | "en_route" | "arrived" | "resolved" | "escalated";

function limit(value: string, maximum: number) {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}

export function buildPrivacyMinimizedSms(incident: Incident, priority: NotificationPriority) {
  const urgency = priority === "critical" ? "Critical emergency" : "Emergency update";
  return `RANEEV: ${urgency} for incident ${incident.publicId}. Open RANEEV for verified details.`;
}

async function sendTwilioSms(input: { to: string; body: string }) {
  const config = getNotificationConfig();
  if (!config.twilioConfigured) return { ok: false as const, error: "Twilio SMS is not configured; in-app delivery remains available." };
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.twilio.accountSid)}/Messages.json`;
  const body = new URLSearchParams({ To: input.to, From: config.twilio.phoneNumber, Body: input.body, ContentRetention: "discard" });
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const payload = await response.json().catch(() => null) as { sid?: unknown; message?: unknown } | null;
    if (!response.ok) return { ok: false as const, error: limit(typeof payload?.message === "string" ? payload.message : `Twilio delivery was not accepted (${response.status}).`, 500) };
    return { ok: true as const, providerMessageId: typeof payload?.sid === "string" ? payload.sid : null };
  } catch (error) {
    return { ok: false as const, error: limit(error instanceof Error ? error.message : "Twilio delivery failed.", 500) };
  }
}

async function deliverNotice(recipient: User, incident: Incident | null, notice: Notice) {
  const preferences = await db.getNotificationPreferences(recipient.id);
  const inAppRequired = notice.priority === "critical" || preferences.inAppEnabled;
  if (inAppRequired) {
    await db.createNotificationIfAbsent({
      dedupeKey: `${notice.key}:${recipient.id}:in-app`, recipientUserId: recipient.id, incidentId: incident?.id ?? null,
      type: notice.type, priority: notice.priority, channel: "in_app", status: "delivered_demo", provider: "demo",
      title: limit(notice.title, 180), message: limit(notice.message, 500), sentAt: new Date(),
    });
  }

  if (!incident || !preferences.smsEnabled || !recipient.phone || getNotificationConfig().provider !== "twilio") return;
  const sms = await db.createNotificationIfAbsent({
    dedupeKey: `${notice.key}:${recipient.id}:sms`, recipientUserId: recipient.id, incidentId: incident.id,
    type: notice.type, priority: notice.priority, channel: "sms", status: "pending", provider: "twilio",
    title: limit(notice.title, 180), message: buildPrivacyMinimizedSms(incident, notice.priority),
  });
  if (!sms.created) return;
  const result = await sendTwilioSms({ to: recipient.phone, body: buildPrivacyMinimizedSms(incident, notice.priority) });
  await db.updateNotificationDelivery(sms.notification.id, result.ok
    ? { status: "sent", provider: "twilio", providerMessageId: result.providerMessageId, sentAt: new Date() }
    : { status: "failed", provider: "twilio", errorMessage: result.error });
}

async function notifyMany(recipients: User[], incident: Incident | null, notice: Notice) {
  await Promise.all(recipients.map(async recipient => {
    try { await deliverNotice(recipient, incident, notice); }
    catch (error) { console.warn("[Notifications] Delivery recording failed:", error instanceof Error ? error.message : error); }
  }));
}

export async function notifyIncidentCreated(incident: Incident) {
  await notifyMany([await db.getUserById(incident.createdByUserId)].filter((user): user is User => Boolean(user)), incident, {
    key: `${incident.id}:created`, type: "emergency_confirmation", priority: "critical", title: "Emergency request confirmed", message: "Your emergency request is active. RANEEV is searching for nearby verified responders.",
  });
  const [volunteers, coordinators] = await Promise.all([db.listAvailableVolunteersNearIncident(incident), db.listCoordinatorRecipients()]);
  await notifyMany(volunteers, incident, { key: `${incident.id}:nearby`, type: "nearby_emergency", priority: "high", title: "Nearby emergency request", message: "A verified emergency request is nearby. Open RANEEV to review and decide whether to respond." });
  await notifyMany(coordinators, incident, { key: `${incident.id}:coordinator-created`, type: "coordinator_critical", priority: "high", title: "New emergency request", message: `Incident ${incident.publicId} is searching for an available verified responder.` });
}

export async function notifyIncidentLifecycle(incident: Incident, event: Exclude<IncidentEvent, "created" | "escalated">) {
  const citizen = await db.getUserById(incident.createdByUserId);
  const volunteer = incident.assignedVolunteerId ? await db.getUserById(incident.assignedVolunteerId) : null;
  const coordinators = await db.listCoordinatorRecipients();
  const recipientGroups: User[] = [citizen, volunteer, ...coordinators].filter((user): user is User => Boolean(user));
  const notices: Record<Exclude<IncidentEvent, "created" | "escalated">, Notice> = {
    accepted: { key: `${incident.id}:accepted`, type: "responder_assigned", priority: "high", title: "Responder assigned", message: "A verified responder has accepted this emergency request." },
    en_route: { key: `${incident.id}:en-route`, type: "responder_en_route", priority: "high", title: "Responder en route", message: "The assigned responder is now travelling to the incident." },
    arrived: { key: `${incident.id}:arrived`, type: "responder_arrived", priority: "high", title: "Responder arrived", message: "The assigned responder has arrived at the incident location." },
    resolved: { key: `${incident.id}:resolved`, type: "incident_resolved", priority: "normal", title: "Incident resolved", message: "This incident has been marked resolved. The shared timeline remains available to authorized participants." },
  };
  await notifyMany(recipientGroups, incident, notices[event]);
}

export async function notifyIncidentEscalated(incident: Incident) {
  const citizen = await db.getUserById(incident.createdByUserId);
  const volunteer = incident.assignedVolunteerId ? await db.getUserById(incident.assignedVolunteerId) : null;
  const coordinators = await db.listCoordinatorRecipients();
  await notifyMany([citizen, volunteer, ...coordinators].filter((user): user is User => Boolean(user)), incident, {
    key: `${incident.id}:escalated`, type: "coordinator_escalated", priority: "critical", title: "Emergency escalation recorded", message: "This incident requires elevated coordination. Follow authorized RANEEV operational updates and local emergency protocols.",
  });
}

export async function notifyDemoLifecycle(incident: Incident, stage: DemoStage, actors: { citizen: User; volunteer: User; coordinator: User; admin: User }) {
  const notices: Record<DemoStage, Notice> = {
    new_emergency: { key: `${incident.id}:demo:new`, type: "emergency_confirmation", priority: "critical", title: "DEMO NOTIFICATION · New emergency", message: "Demo emergency detected. Golden Hour Response is active." },
    responder_detected: { key: `${incident.id}:demo:detected`, type: "nearby_emergency", priority: "high", title: "DEMO NOTIFICATION · Responder detected", message: "A nearby demo responder has been detected for this controlled scenario." },
    responder_accepted: { key: `${incident.id}:demo:accepted`, type: "responder_assigned", priority: "high", title: "DEMO NOTIFICATION · Responder accepted", message: "Arjun Kumar — Demo Responder accepted the controlled demo emergency." },
    responder_moving: { key: `${incident.id}:demo:moving`, type: "responder_en_route", priority: "high", title: "DEMO NOTIFICATION · Responder en route", message: "The demo responder is travelling along the predefined response route." },
    responder_arrived: { key: `${incident.id}:demo:arrived`, type: "responder_arrived", priority: "high", title: "DEMO NOTIFICATION · Responder arrived", message: "The demo responder has arrived at the controlled incident location." },
    incident_resolved: { key: `${incident.id}:demo:resolved`, type: "incident_resolved", priority: "normal", title: "DEMO NOTIFICATION · Response completed", message: "The controlled demo emergency response is complete." },
  };
  const notice = notices[stage];
  await Promise.all([actors.citizen, actors.volunteer, actors.coordinator, actors.admin].map(recipient => db.createNotificationIfAbsent({
    dedupeKey: `${notice.key}:${recipient.id}:in-app`, recipientUserId: recipient.id, incidentId: incident.id,
    type: notice.type, priority: notice.priority, channel: "in_app", status: "delivered_demo", provider: "demo",
    title: limit(notice.title, 180), message: limit(notice.message, 500), sentAt: new Date(),
  })));
}

export async function processNotificationEscalations() {
  const config = getNotificationConfig();
  const responderCutoff = new Date(Date.now() - config.responderSearchTimeoutSeconds * 1_000);
  const escalationCutoff = new Date(Date.now() - config.escalationTimeoutSeconds * 1_000);
  const [overdue, escalatedOverdue] = await Promise.all([db.listSearchingIncidentsCreatedBefore(responderCutoff), db.listEscalatedIncidentsBefore(escalationCutoff)]);
  const coordinators = await db.listCoordinatorRecipients();
  await Promise.all(overdue.map(incident => notifyMany(coordinators, incident, {
    key: `${incident.id}:no-responder`, type: "coordinator_no_responder", priority: "critical", title: "Responder search timeout", message: `Incident ${incident.publicId} has no assigned responder after the configured search window. Review escalation and coverage actions.`,
  })));
  await Promise.all(escalatedOverdue.map(incident => notifyMany(coordinators, incident, {
    key: `${incident.id}:escalation-timeout`, type: "coordinator_escalated", priority: "critical", title: "Escalation follow-up due", message: `Incident ${incident.publicId} remains open after the configured escalation window. Review expanded response and professional-service coordination.`,
  })));
  return { scanned: overdue.length, coordinatorAlerts: overdue.length * coordinators.length, escalationScanned: escalatedOverdue.length, escalationAlerts: escalatedOverdue.length * coordinators.length };
}
