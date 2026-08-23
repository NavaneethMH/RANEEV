import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const screenshotDir = process.env.RANEEV_SCREENSHOT_DIR ?? "/home/ubuntu/raneev-notification-screenshots";
await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });

async function login(email, password, destination, options = {}) {
  const context = await browser.newContext({ viewport: options.viewport ?? { width: 1280, height: 900 }, geolocation: { latitude: 12.9718, longitude: 77.5948 }, permissions: ["geolocation"] });
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email or phone").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/(citizen|coordinator|admin|volunteer)(?:\/|$)/, { timeout: 15_000 });
  if (destination) await page.goto(`${baseURL}${destination}`, { waitUntil: "domcontentloaded" });
  return { context, page };
}

async function trpc(page, procedure, input) {
  const response = await page.evaluate(async ({ procedure, input }) => {
    const queries = new Set(["notifications.inbox", "notifications.preferences", "admin.notificationAudits", "volunteer.nearbyIncidents", "coordinator.activeIncidents"]);
    const query = queries.has(procedure);
    const url = query ? `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : `/api/trpc/${procedure}`;
    const result = await fetch(url, query ? { method: "GET" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
    return { status: result.status, text: await result.text() };
  }, { procedure, input });
  const parsed = JSON.parse(response.text);
  if (response.status >= 400 || parsed.error) throw Object.assign(new Error(parsed.error?.json?.message ?? `tRPC ${procedure} failed`), { status: response.status, parsed });
  return parsed.result?.data?.json ?? parsed.result?.data ?? parsed;
}

async function waitForInbox(page, predicate, label) {
  const until = Date.now() + 12_000;
  while (Date.now() < until) {
    const inbox = await trpc(page, "notifications.inbox", undefined);
    if (predicate(inbox)) return inbox;
    await page.waitForTimeout(250);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

try {
  const volunteer = await login("volunteer.demo@raneev.test", "Raneev!Volunteer26", "/volunteer");
  try { await trpc(volunteer.page, "volunteer.completeDevelopmentVerification", undefined); } catch { /* already verified */ }
  await trpc(volunteer.page, "volunteer.setAvailability", { availability: "available", latitude: 12.9718, longitude: 77.5948 });

  const citizen = await login("citizen.demo@raneev.test", "Raneev!Citizen26", "/citizen");
  const incident = await trpc(citizen.page, "incidents.create", { emergencyType: "medical", locationLabel: "Notification verification area", latitude: 12.9716, longitude: 77.5946, accuracyMeters: 20, description: "Private verification details must stay out of notifications." });
  const citizenCreated = await waitForInbox(citizen.page, inbox => inbox.items.some(item => item.publicId === incident.publicId && item.notification.type === "emergency_confirmation"), "citizen confirmation");
  const confirmation = citizenCreated.items.find(item => item.publicId === incident.publicId && item.notification.type === "emergency_confirmation");
  if (!confirmation || confirmation.notification.status !== "delivered_demo" || /Notification verification area|Private verification/i.test(confirmation.notification.message)) throw new Error("Citizen confirmation did not preserve default demo delivery or notification privacy.");

  const volunteerNearby = await waitForInbox(volunteer.page, inbox => inbox.items.some(item => item.publicId === incident.publicId && item.notification.type === "nearby_emergency"), "nearby volunteer alert");
  if (!volunteerNearby.items.some(item => item.publicId === incident.publicId && item.notification.type === "nearby_emergency")) throw new Error("Available volunteer did not receive nearby incident notification.");
  const nearby = await trpc(volunteer.page, "volunteer.nearbyIncidents", undefined);
  if (!nearby.some(item => item.publicId === incident.publicId)) throw new Error("Shared nearby matching did not expose the notification verification incident.");
  await trpc(volunteer.page, "volunteer.accept", { publicId: incident.publicId });
  await trpc(volunteer.page, "volunteer.startRoute", { publicId: incident.publicId });
  await trpc(volunteer.page, "volunteer.arrive", { publicId: incident.publicId });

  const coordinator = await login("coordinator.demo@raneev.test", "Raneev!Coord26", "/coordinator");
  await trpc(coordinator.page, "ghr.escalate", { publicId: incident.publicId, escalation: "monitoring", note: "Notification verification escalation." });
  await trpc(volunteer.page, "volunteer.resolve", { publicId: incident.publicId });

  const activeIncidents = await trpc(coordinator.page, "coordinator.activeIncidents", undefined);
  const overdue = activeIncidents.find(item => item.status === "searching" && !item.assignedVolunteerId && Date.now() - new Date(item.createdAt).getTime() > 300_000);
  if (!overdue) throw new Error("No existing overdue unassigned shared incident was available for timeout escalation verification.");
  const escalationBefore = await trpc(coordinator.page, "notifications.inbox", undefined);
  const countTimeoutAlerts = inbox => inbox.items.filter(item => item.publicId === overdue.publicId && item.notification.type === "coordinator_no_responder").length;
  await trpc(coordinator.page, "notifications.processDevelopmentEscalations", undefined);
  const expectedTimeoutAlerts = Math.max(1, countTimeoutAlerts(escalationBefore));
  const escalationAfterFirst = await waitForInbox(coordinator.page, inbox => countTimeoutAlerts(inbox) === expectedTimeoutAlerts, "coordinator timeout escalation");
  await trpc(coordinator.page, "notifications.processDevelopmentEscalations", undefined);
  const escalationAfterSecond = await trpc(coordinator.page, "notifications.inbox", undefined);
  const timeoutIdempotent = countTimeoutAlerts(escalationAfterSecond) === countTimeoutAlerts(escalationAfterFirst);
  if (!timeoutIdempotent) throw new Error("Responder-search timeout escalation was not idempotent across repeat processing.");
  const overdueEscalated = activeIncidents.find(item => item.ghrEscalatedAt && item.status !== "resolved" && Date.now() - new Date(item.ghrEscalatedAt).getTime() > 600_000);
  if (!overdueEscalated) throw new Error("No existing overdue manually escalated shared incident was available for escalation-timeout verification.");
  const countEscalationTimeoutAlerts = inbox => inbox.items.filter(item => item.publicId === overdueEscalated.publicId && item.notification.type === "coordinator_escalated" && /follow-up due/i.test(item.notification.title)).length;
  const escalationTimeoutBefore = await trpc(coordinator.page, "notifications.inbox", undefined);
  await trpc(coordinator.page, "notifications.processDevelopmentEscalations", undefined);
  const escalationTimeoutAfterFirst = await waitForInbox(coordinator.page, inbox => countEscalationTimeoutAlerts(inbox) === Math.max(1, countEscalationTimeoutAlerts(escalationTimeoutBefore)), "coordinator escalation timeout");
  await trpc(coordinator.page, "notifications.processDevelopmentEscalations", undefined);
  const escalationTimeoutAfterSecond = await trpc(coordinator.page, "notifications.inbox", undefined);
  const escalationTimeoutIdempotent = countEscalationTimeoutAlerts(escalationTimeoutAfterSecond) === countEscalationTimeoutAlerts(escalationTimeoutAfterFirst);
  if (!escalationTimeoutIdempotent) throw new Error("Escalation-timeout alerts were not idempotent across repeat processing.");

  const citizenResolved = await waitForInbox(citizen.page, inbox => inbox.items.some(item => item.publicId === incident.publicId && item.notification.type === "incident_resolved"), "citizen resolution update");
  const assigned = citizenResolved.items.some(item => item.publicId === incident.publicId && item.notification.type === "responder_assigned");
  const enRoute = citizenResolved.items.some(item => item.publicId === incident.publicId && item.notification.type === "responder_en_route");
  const arrived = citizenResolved.items.some(item => item.publicId === incident.publicId && item.notification.type === "responder_arrived");
  const escalated = citizenResolved.items.some(item => item.publicId === incident.publicId && item.notification.type === "coordinator_escalated");
  if (![assigned, enRoute, arrived, escalated].every(Boolean)) throw new Error("Citizen did not receive the full shared lifecycle notification sequence.");
  const unreadBefore = citizenResolved.unreadCount;
  await trpc(citizen.page, "notifications.markRead", { notificationId: confirmation.notification.id });
  const readInbox = await trpc(citizen.page, "notifications.inbox", undefined);
  if (readInbox.unreadCount >= unreadBefore || !readInbox.items.some(item => item.notification.id === confirmation.notification.id && item.notification.readAt)) throw new Error("Notification read state did not persist for the recipient.");

  const admin = await login("admin.demo@raneev.test", "Raneev!Admin26", "/admin");
  const audits = await trpc(admin.page, "admin.notificationAudits", undefined);
  const audit = audits.find(item => item.publicId === incident.publicId && item.type === "emergency_confirmation");
  if (!audit || "message" in audit || "recipientName" in audit || audit.status !== "delivered_demo") throw new Error("Admin notification audit exposed private message or recipient identity data, or missed demo delivery status.");
  await admin.page.goto(`${baseURL}/admin/notifications`, { waitUntil: "domcontentloaded" });
  await admin.page.getByText("Review delivery outcomes without message exposure.", { exact: false }).waitFor({ timeout: 20_000 });
  await admin.page.screenshot({ path: `${screenshotDir}/notification-audit-admin.png`, fullPage: true });
  await admin.context.close();

  await citizen.page.goto(`${baseURL}/citizen/live/${incident.publicId}`, { waitUntil: "domcontentloaded" });
  await citizen.page.getByRole("button", { name: /notification/i }).click();
  await citizen.page.getByRole("button", { name: new RegExp(`Incident resolved[\\s\\S]*${incident.publicId}`) }).waitFor({ timeout: 20_000 });
  await citizen.page.screenshot({ path: `${screenshotDir}/notification-inbox-desktop.png`, fullPage: true });
  await citizen.context.close();
  await volunteer.context.close();
  await coordinator.context.close();

  const mobile = await login("citizen.demo@raneev.test", "Raneev!Citizen26", `/citizen/live/${incident.publicId}`, { viewport: { width: 375, height: 812 } });
  await mobile.page.getByRole("button", { name: /notification/i }).click();
  await mobile.page.getByRole("heading", { name: /notification/i }).waitFor({ timeout: 20_000 });
  const mobileOverflow = await mobile.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (mobileOverflow) throw new Error("Notification inbox introduced mobile horizontal overflow.");
  await mobile.page.screenshot({ path: `${screenshotDir}/notification-inbox-mobile.png`, fullPage: true });
  await mobile.context.close();
  console.log(JSON.stringify({ publicId: incident.publicId, citizenLifecycle: { assigned, enRoute, arrived, escalated, resolved: true }, demoDelivery: confirmation.notification.status, adminAuditPrivacy: true, timeoutEscalationIncident: overdue.publicId, timeoutIdempotent, escalationTimeoutIncident: overdueEscalated.publicId, escalationTimeoutIdempotent, mobileOverflow }));
} finally {
  await browser.close();
}
