import { chromium } from "playwright";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
const suffix = Date.now();
const password = "Raneev!MasterMvp26";
const volunteerOneName = `QA Master MVP Volunteer One ${suffix}`;
const volunteerTwoName = `QA Master MVP Volunteer Two ${suffix}`;

async function raw(page, procedure, input, query = false) {
  return page.evaluate(async ({ procedure, input, query }) => {
    const url = query ? `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : `/api/trpc/${procedure}`;
    const response = await fetch(url, query ? { method: "GET" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
    return { status: response.status, body: JSON.parse(await response.text()) };
  }, { procedure, input, query });
}

async function trpc(page, procedure, input, query = false) {
  const response = await raw(page, procedure, input, query);
  if (response.status >= 400 || response.body.error) throw new Error(response.body.error?.json?.message ?? `tRPC ${procedure} failed`);
  const data = response.body.result?.data;
  return data && typeof data === "object" && "json" in data ? data.json : data ?? response.body;
}

async function createPage() {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  return { context, page };
}

async function register(page, name, email, role) {
  return trpc(page, "auth.register", { name, email, password, role });
}

try {
  const citizen = await createPage();
  const volunteerOne = await createPage();
  const volunteerTwo = await createPage();
  const coordinator = await createPage();
  try {
    await register(citizen.page, "QA Master MVP Citizen", `qa.master.citizen.${suffix}@raneev.test`, "citizen");
    await Promise.all([
      register(volunteerOne.page, volunteerOneName, `qa.master.one.${suffix}@raneev.test`, "volunteer"),
      register(volunteerTwo.page, volunteerTwoName, `qa.master.two.${suffix}@raneev.test`, "volunteer"),
    ]);
    await trpc(coordinator.page, "auth.login", { email: "coordinator.demo@raneev.test", password: "Raneev!Coord26" });
    await citizen.page.goto(`${baseURL}/citizen/report`, { waitUntil: "domcontentloaded" });
    await citizen.page.getByText("Violence or safety threat", { exact: true }).click();
    await Promise.all([
      trpc(volunteerOne.page, "volunteer.completeDevelopmentVerification", undefined),
      trpc(volunteerTwo.page, "volunteer.completeDevelopmentVerification", undefined),
    ]);
    await Promise.all([
      trpc(volunteerOne.page, "volunteer.setAvailability", { availability: "available", latitude: 12.9718, longitude: 77.5948 }),
      trpc(volunteerTwo.page, "volunteer.setAvailability", { availability: "available", latitude: 12.9719, longitude: 77.5949 }),
    ]);
    const incident = await trpc(citizen.page, "incidents.create", { emergencyType: "violence", locationLabel: "QA Master MVP controlled lifecycle fixture", latitude: 12.9717, longitude: 77.5947, accuracyMeters: 8, description: "Controlled coordinator assignment and cancellation validation." });
    const candidates = await trpc(coordinator.page, "coordinator.assignmentCandidates", { publicId: incident.publicId }, true);
    const first = candidates.find(candidate => candidate.name === volunteerOneName);
    const second = candidates.find(candidate => candidate.name === volunteerTwoName);
    if (!first || !second) throw new Error("Expected verified nearby assignment candidates were not returned.");
    const unauthorized = await raw(citizen.page, "coordinator.assignResponder", { publicId: incident.publicId, volunteerUserId: first.id });
    if (unauthorized.status !== 403) throw new Error("A citizen reached the coordinator assignment operation.");
    await coordinator.page.goto(`${baseURL}/coordinator/ghr/${incident.publicId}`, { waitUntil: "domcontentloaded" });
    await coordinator.page.getByRole("button", { name: new RegExp(`${volunteerOneName}.*Assign`) }).click();
    await coordinator.page.getByText("Reassign before arrival").waitFor({ timeout: 20_000 });
    const assigned = await trpc(coordinator.page, "incidents.byPublicId", { publicId: incident.publicId }, true);
    if (assigned.assignedVolunteerId !== first.id || assigned.status !== "accepted") throw new Error("Coordinator assignment did not persist the first responder.");
    const reassigned = await trpc(coordinator.page, "coordinator.assignResponder", { publicId: incident.publicId, volunteerUserId: second.id });
    if (reassigned.assignedVolunteerId !== second.id || reassigned.status !== "accepted") throw new Error("Coordinator reassignment did not persist the second responder.");
    const firstReadiness = await trpc(volunteerOne.page, "volunteer.readiness", undefined, true);
    if (firstReadiness.availability !== "available") throw new Error("The prior responder was not released after reassignment.");
    const cancelled = await trpc(coordinator.page, "coordinator.cancelIncident", { publicId: incident.publicId, reason: "Controlled Master MVP reassignment and cancellation validation." });
    if (cancelled.status !== "cancelled" || cancelled.cancellationReason !== "Controlled Master MVP reassignment and cancellation validation.") throw new Error("Coordinator cancellation did not persist terminal status and reason.");
    const secondReadiness = await trpc(volunteerTwo.page, "volunteer.readiness", undefined, true);
    if (secondReadiness.availability !== "available") throw new Error("The active responder was not released after cancellation.");
    const timeline = await trpc(citizen.page, "incidents.timeline", { publicId: incident.publicId }, true);
    const eventTypes = timeline.map(event => event.eventType);
    for (const required of ["coordinator_assigned", "responder_reassigned", "cancelled"]) if (!eventTypes.includes(required)) throw new Error(`Missing audited lifecycle event: ${required}`);
    console.log(JSON.stringify({ publicId: incident.publicId, persistedEmergencyType: incident.emergencyType, coordinatorAuthorization: true, coordinatorAssignment: true, reassignment: true, cancellation: true, releasedResponders: true, auditedEvents: eventTypes.filter(event => ["coordinator_assigned", "responder_reassigned", "cancelled"].includes(event)) }));
  } finally {
    await Promise.all([citizen.context.close(), volunteerOne.context.close(), volunteerTwo.context.close(), coordinator.context.close()]);
  }
} finally {
  await browser.close();
}
