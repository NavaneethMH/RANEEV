import { chromium } from "playwright";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const password = "Raneev!QaTimeout26";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });

async function trpc(page, procedure, input) {
  const response = await page.evaluate(async ({ procedure, input }) => {
    const isQuery = procedure === "notifications.inbox";
    const url = isQuery ? `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : `/api/trpc/${procedure}`;
    const result = await fetch(url, isQuery ? { method: "GET" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
    return { status: result.status, text: await result.text() };
  }, { procedure, input });
  const parsed = JSON.parse(response.text);
  if (response.status >= 400 || parsed.error) throw new Error(parsed.error?.json?.message ?? `tRPC ${procedure} failed`);
  const data = parsed.result?.data;
  return data && typeof data === "object" && "json" in data ? data.json : data ?? parsed;
}

async function login(email, loginPassword) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email or phone").fill(email);
  await page.getByLabel("Password").fill(loginPassword);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/(citizen|coordinator)(?:\/|$)/, { timeout: 15_000 });
  return { context, page };
}

function countAlerts(inbox, publicId, type, title) {
  return inbox.items.filter(item => item.publicId === publicId && item.notification.type === type && item.notification.title === title).length;
}

try {
  const coordinator = await login("coordinator.demo@raneev.test", "Raneev!Coord26");
  const citizenContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const citizen = await citizenContext.newPage();
  const email = `qa.timeout.${Date.now()}@raneev.test`;
  const createdPublicIds = [];
  try {
    await citizen.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
    await trpc(citizen, "auth.register", { name: "QA Timeout Citizen", email, password, role: "citizen" });
    const registeredCookies = await citizenContext.cookies(baseURL);
    if (!registeredCookies.some(cookie => cookie.name === "raneev_session")) throw new Error("QA timeout fixture registration did not establish a same-origin credential session.");

    const searching = await trpc(citizen, "incidents.create", {
      emergencyType: "medical", locationLabel: "QA timeout fixture · responder-search", latitude: 12.9716, longitude: 77.5946, accuracyMeters: 15, description: "Controlled idempotency verification fixture.",
    });
    createdPublicIds.push(searching.publicId);
    await trpc(coordinator.page, "notifications.ageDevelopmentTimeoutFixture", { publicId: searching.publicId, kind: "responder_search" });
    const searchBefore = await trpc(coordinator.page, "notifications.inbox", undefined);
    if (countAlerts(searchBefore, searching.publicId, "coordinator_no_responder", "Responder search timeout") !== 0) throw new Error("Fresh responder-search fixture unexpectedly had a timeout alert before processing.");
    await trpc(coordinator.page, "notifications.processDevelopmentEscalations", undefined);
    const searchAfterFirst = await trpc(coordinator.page, "notifications.inbox", undefined);
    const searchFirstCount = countAlerts(searchAfterFirst, searching.publicId, "coordinator_no_responder", "Responder search timeout");
    await trpc(coordinator.page, "notifications.processDevelopmentEscalations", undefined);
    const searchAfterSecond = await trpc(coordinator.page, "notifications.inbox", undefined);
    const searchSecondCount = countAlerts(searchAfterSecond, searching.publicId, "coordinator_no_responder", "Responder search timeout");
    if (searchFirstCount !== 1 || searchSecondCount !== 1) throw new Error(`Responder-search timeout was not exactly-once across repeat processing (${searchFirstCount}, ${searchSecondCount}).`);

    const escalated = await trpc(citizen, "incidents.create", {
      emergencyType: "road_accident", locationLabel: "QA timeout fixture · escalation", latitude: 12.972, longitude: 77.595, accuracyMeters: 15, description: "Controlled escalation idempotency verification fixture.",
    });
    createdPublicIds.push(escalated.publicId);
    await trpc(coordinator.page, "ghr.escalate", { publicId: escalated.publicId, escalation: "professional_services_contacted", note: "Controlled QA escalation fixture." });
    await trpc(coordinator.page, "notifications.ageDevelopmentTimeoutFixture", { publicId: escalated.publicId, kind: "escalation" });
    const escalationBefore = await trpc(coordinator.page, "notifications.inbox", undefined);
    if (countAlerts(escalationBefore, escalated.publicId, "coordinator_escalated", "Escalation follow-up due") !== 0) throw new Error("Fresh escalation fixture unexpectedly had a follow-up alert before processing.");
    await trpc(coordinator.page, "notifications.processDevelopmentEscalations", undefined);
    const escalationAfterFirst = await trpc(coordinator.page, "notifications.inbox", undefined);
    const escalationFirstCount = countAlerts(escalationAfterFirst, escalated.publicId, "coordinator_escalated", "Escalation follow-up due");
    await trpc(coordinator.page, "notifications.processDevelopmentEscalations", undefined);
    const escalationAfterSecond = await trpc(coordinator.page, "notifications.inbox", undefined);
    const escalationSecondCount = countAlerts(escalationAfterSecond, escalated.publicId, "coordinator_escalated", "Escalation follow-up due");
    if (escalationFirstCount !== 1 || escalationSecondCount !== 1) throw new Error(`Escalation timeout was not exactly-once across repeat processing (${escalationFirstCount}, ${escalationSecondCount}).`);

    console.log(JSON.stringify({ email, responderSearch: { publicId: searching.publicId, before: 0, afterFirst: searchFirstCount, afterSecond: searchSecondCount }, escalationFollowUp: { publicId: escalated.publicId, before: 0, afterFirst: escalationFirstCount, afterSecond: escalationSecondCount }, cleanupResolved: true }));
  } finally {
    for (const publicId of createdPublicIds) {
      try { await trpc(coordinator.page, "notifications.cleanupDevelopmentTimeoutFixture", { publicId }); }
      catch { /* A failed setup may already have completed or prevented fixture creation. */ }
    }
    await citizenContext.close();
    await coordinator.context.close();
  }
} finally {
  await browser.close();
}
