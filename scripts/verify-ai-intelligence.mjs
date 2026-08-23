import { chromium } from "playwright";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });

async function login(email, password, destination) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email or phone").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/(citizen|coordinator|admin|volunteer)(?:\/|$)/, { timeout: 15_000 });
  if (destination) await page.goto(`${baseURL}${destination}`, { waitUntil: "domcontentloaded" });
  return { context, page };
}

async function trpc(page, procedure, input) {
  const response = await page.evaluate(async ({ procedure, input }) => {
    const isQuery = ["ai.citizenStatus", "ai.incidentInsight", "ai.responderRecommendations", "admin.aiAudits"].includes(procedure);
    const url = isQuery ? `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : `/api/trpc/${procedure}`;
    const result = await fetch(url, isQuery ? { method: "GET" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
    return { status: result.status, text: await result.text() };
  }, { procedure, input });
  let parsed;
  try { parsed = JSON.parse(response.text); } catch { throw new Error(`Non-JSON response from ${procedure}: ${response.text.slice(0, 200)}`); }
  if (response.status >= 400 || parsed.error) throw Object.assign(new Error(parsed.error?.json?.message ?? `tRPC ${procedure} failed`), { status: response.status, parsed });
  return parsed.result?.data?.json ?? parsed.result?.data ?? parsed;
}

async function createAvailableVolunteer() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  const email = `ai.verification.${Date.now()}@raneev.test`;
  await trpc(page, "auth.register", { name: "AI Verification Volunteer", email, phone: "+91 90000 09999", password: "Raneev!AiVerify26", role: "volunteer" });
  await trpc(page, "volunteer.completeDevelopmentVerification", undefined);
  await trpc(page, "volunteer.setAvailability", { availability: "available", latitude: 12.9718, longitude: 77.5948 });
  await context.close();
  return email;
}

try {
  const verificationVolunteer = await createAvailableVolunteer();
  const citizen = await login("citizen.demo@raneev.test", "Raneev!Citizen26", "/citizen");
  const incident = await trpc(citizen.page, "incidents.create", { emergencyType: "medical", locationLabel: "AI verification area", latitude: 12.9716, longitude: 77.5946, accuracyMeters: 24, description: "A person collapsed and is not responding. Contact 9876543210." });
  await citizen.context.close();

  const coordinator = await login("coordinator.demo@raneev.test", "Raneev!Coord26", "/coordinator");
  let queued = await trpc(coordinator.page, "ai.processDevelopmentQueue", undefined);
  let insight = await trpc(coordinator.page, "ai.incidentInsight", { publicId: incident.publicId });
  if (insight.status !== "succeeded") {
    queued = [...queued, ...(await trpc(coordinator.page, "ai.processDevelopmentQueue", undefined))];
    insight = await trpc(coordinator.page, "ai.incidentInsight", { publicId: incident.publicId });
  }
  if (!queued.length || insight.status !== "succeeded" || !insight.available || !insight.analysis) throw new Error("AI queue did not produce a successful validated coordinator insight.");
  const recommendations = await trpc(coordinator.page, "ai.responderRecommendations", { publicId: incident.publicId });
  if (!Array.isArray(recommendations) || !recommendations.length) throw new Error("Deterministic responder recommendation contract returned no eligible verified candidate.");
  const assistant = await trpc(coordinator.page, "ai.assistant", { question: "Which active incident needs attention first?" });
  if (!assistant.answer || !Array.isArray(assistant.citedIncidentIds)) throw new Error("Coordinator assistant did not return its validated operational format.");
  await coordinator.page.goto(`${baseURL}/coordinator/ghr/${incident.publicId}`, { waitUntil: "networkidle" });
  await coordinator.page.getByText("AI-assisted incident classification", { exact: false }).waitFor({ timeout: 30_000 });
  await coordinator.page.screenshot({ path: "/home/ubuntu/raneev-ai-intelligence.png", fullPage: true });
  await coordinator.page.goto(`${baseURL}/coordinator`, { waitUntil: "domcontentloaded" });
  await coordinator.page.getByPlaceholder("Ask about current authorized incidents or responder readiness…").waitFor({ timeout: 30_000 });
  await coordinator.page.getByRole("button", { name: "Which active incident needs attention first?" }).click();
  await coordinator.page.waitForFunction(() => document.querySelectorAll("p.whitespace-pre-wrap").length >= 2, { timeout: 60_000 });
  await coordinator.page.screenshot({ path: "/home/ubuntu/raneev-ai-command-center.png", fullPage: true });
  await coordinator.context.close();

  const mobile = await login("coordinator.demo@raneev.test", "Raneev!Coord26", "/coordinator");
  await mobile.page.setViewportSize({ width: 375, height: 812 });
  await mobile.page.getByPlaceholder("Ask about current authorized incidents or responder readiness…").waitFor({ timeout: 30_000 });
  const mobileOverflow = await mobile.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (mobileOverflow) throw new Error("Coordinator AI assistant introduced mobile horizontal overflow.");
  await mobile.page.screenshot({ path: "/home/ubuntu/raneev-ai-command-center-mobile.png", fullPage: true });
  await mobile.context.close();

  const citizenCheck = await login("citizen.demo@raneev.test", "Raneev!Citizen26", "/citizen");
  let denied = false;
  try { await trpc(citizenCheck.page, "ai.incidentInsight", { publicId: incident.publicId }); } catch (error) { denied = error.status === 403; }
  const citizenStatus = await trpc(citizenCheck.page, "ai.citizenStatus", { publicId: incident.publicId });
  await citizenCheck.page.goto(`${baseURL}/citizen/live/${incident.publicId}`, { waitUntil: "domcontentloaded" });
  await citizenCheck.page.getByText("Coordination update", { exact: false }).waitFor({ timeout: 30_000 });
  await citizenCheck.context.close();
  if (!denied || typeof citizenStatus.message !== "string" || /classification|recommendation|severity/i.test(citizenStatus.message)) throw new Error("Citizen AI boundary did not preserve a safe status-only update.");
  const admin = await login("admin.demo@raneev.test", "Raneev!Admin26", "/admin");
  const audits = await trpc(admin.page, "admin.aiAudits", undefined);
  await admin.page.goto(`${baseURL}/admin/ai`, { waitUntil: "domcontentloaded" });
  await admin.page.getByText("Review AI operations and safeguards.", { exact: false }).waitFor({ timeout: 30_000 });
  await admin.context.close();
  const latestAssistantAudit = audits.find(entry => entry.audit.operation === "coordinator_assistant");
  console.log(JSON.stringify({ incidentId: incident.publicId, verificationVolunteer, queuedJobs: queued.length, aiSeverity: insight.analysis.classification.severity, responderRecommendationCount: recommendations.length, assistantAvailable: assistant.available, citizenInsightDenied: denied, citizenSafeStatus: citizenStatus.state, assistantAuditStatus: latestAssistantAudit?.audit.status ?? null, assistantFailure: latestAssistantAudit?.audit.failureCode ?? null, mobileOverflow }));
} finally {
  await browser.close();
}
