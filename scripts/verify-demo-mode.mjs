import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const screenshotDir = process.env.RANEEV_SCREENSHOT_DIR ?? "/home/ubuntu/raneev-demo-screenshots";
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
    const queries = new Set(["demo.status", "incidents.active", "incidents.byPublicId", "incidents.timeline", "incidents.mapSnapshot", "volunteer.nearbyIncidents", "volunteer.activeIncident", "coordinator.commandCenter", "notifications.inbox"]);
    const query = queries.has(procedure);
    const url = query ? `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : `/api/trpc/${procedure}`;
    const result = await fetch(url, query ? { method: "GET" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
    return { status: result.status, text: await result.text() };
  }, { procedure, input });
  const parsed = JSON.parse(response.text);
  if (response.status >= 400 || parsed.error) throw new Error(parsed.error?.json?.message ?? `tRPC ${procedure} failed`);
  return parsed.result?.data?.json ?? parsed.result?.data ?? parsed;
}

async function waitFor(page, predicate, label, timeout = 12_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const value = await trpc(page, "demo.status", undefined);
    if (predicate(value)) return value;
    await page.waitForTimeout(250);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function skipTo(page, stage) {
  let state = await trpc(page, "demo.status", undefined);
  const order = ["new_emergency", "responder_detected", "responder_accepted", "responder_moving", "responder_arrived", "incident_resolved"];
  while (order.indexOf(state.stage) < order.indexOf(stage)) state = await trpc(page, "demo.skip", undefined);
  return state;
}

try {
  const coordinator = await login("coordinator.demo@raneev.test", "Raneev!Coord26", "/demo");
  const citizen = await login("citizen.demo@raneev.test", "Raneev!Citizen26", "/citizen");
  const volunteer = await login("volunteer.demo@raneev.test", "Raneev!Volunteer26", "/volunteer");
  try {
    await trpc(coordinator.page, "demo.reset", undefined);
    const idle = await trpc(coordinator.page, "demo.status", undefined);
    if (idle.status !== "idle" || idle.incident) throw new Error("Reset did not restore the initial isolated demo state.");

    let state = await trpc(coordinator.page, "demo.start", undefined);
    if (state.stage !== "new_emergency" || !state.incident?.isDemo || state.incident.emergencyType !== "road_accident") throw new Error("Demo start did not create the isolated shared road-accident record.");
    const incidentId = state.incident.publicId;
    const citizenActive = await trpc(citizen.page, "incidents.active", undefined);
    if (citizenActive?.publicId !== incidentId) throw new Error("Citizen workspace did not receive the shared demo incident.");
    const detected = await waitFor(coordinator.page, value => value.stage === "responder_detected", "deterministic responder detection", 8_000);
    const nearby = await trpc(volunteer.page, "volunteer.nearbyIncidents", undefined);
    if (!nearby.some(item => item.publicId === incidentId)) throw new Error("Volunteer workspace did not receive the isolated nearby demo incident.");
    const command = await trpc(coordinator.page, "coordinator.commandCenter", undefined);
    if (!command.activeIncidents.some(item => item.publicId === incidentId && item.isDemo)) throw new Error("Coordinator command center did not receive the demo incident.");

    await trpc(coordinator.page, "demo.pause", undefined);
    const paused = await trpc(coordinator.page, "demo.status", undefined);
    await coordinator.page.waitForTimeout(1200);
    const pausedAfterWait = await trpc(coordinator.page, "demo.status", undefined);
    if (paused.status !== "paused" || pausedAfterWait.elapsedSeconds !== paused.elapsedSeconds) throw new Error("Pause did not freeze the deterministic demo clock.");
    await trpc(coordinator.page, "demo.resume", undefined);
    await skipTo(coordinator.page, "responder_moving");
    const movingOne = await trpc(coordinator.page, "demo.status", undefined);
    const mapOne = await trpc(citizen.page, "incidents.mapSnapshot", { publicId: incidentId });
    await coordinator.page.waitForTimeout(1300);
    const movingTwo = await trpc(coordinator.page, "demo.status", undefined);
    const mapTwo = await trpc(citizen.page, "incidents.mapSnapshot", { publicId: incidentId });
    if (movingOne.stage !== "responder_moving" || movingTwo.stage !== "responder_moving" || !mapOne.responder || !mapTwo.responder || (mapOne.responder.latitude === mapTwo.responder.latitude && mapOne.responder.longitude === mapTwo.responder.longitude)) throw new Error("Responder map position did not progress deterministically during movement.");

    await skipTo(coordinator.page, "incident_resolved");
    const complete = await trpc(coordinator.page, "demo.status", undefined);
    const timeline = await trpc(citizen.page, "incidents.timeline", { publicId: incidentId });
    if (complete.status !== "completed" || timeline.filter(event => /^DEMO:/.test(event.note)).length < 6) throw new Error("Demo lifecycle did not complete with durable shared timeline events.");
    const inbox = await trpc(citizen.page, "notifications.inbox", undefined);
    const demoNotices = inbox.items.filter(item => item.publicId === incidentId && /^DEMO NOTIFICATION/.test(item.notification.title));
    if (demoNotices.length < 6 || demoNotices.some(item => item.notification.status !== "delivered_demo" || item.notification.channel !== "in_app")) throw new Error("Demo lifecycle did not use isolated demo in-app notification delivery.");

    await trpc(coordinator.page, "demo.reset", undefined);
    for (let cycle = 0; cycle < 10; cycle += 1) {
      await trpc(coordinator.page, "demo.start", undefined);
      await skipTo(coordinator.page, "incident_resolved");
      await trpc(coordinator.page, "demo.reset", undefined);
    }
    const finalIdle = await trpc(coordinator.page, "demo.status", undefined);
    if (finalIdle.status !== "idle" || finalIdle.incident) throw new Error("Ten reset-and-run cycles left stale demo state.");

    await trpc(coordinator.page, "demo.start", undefined);
    await skipTo(coordinator.page, "responder_moving");
    await coordinator.page.goto(`${baseURL}/demo`, { waitUntil: "domcontentloaded" });
    await coordinator.page.getByText("Presenter controls", { exact: false }).waitFor({ timeout: 12_000 });
    await coordinator.page.screenshot({ path: `${screenshotDir}/demo-mode-desktop.png`, fullPage: true });
    const mobile = await login("coordinator.demo@raneev.test", "Raneev!Coord26", "/demo", { viewport: { width: 375, height: 812 } });
    await mobile.page.getByText("Presenter controls", { exact: false }).waitFor({ timeout: 12_000 });
    const mobileOverflow = await mobile.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (mobileOverflow) throw new Error("Demo Mode introduced mobile horizontal overflow.");
    await mobile.page.screenshot({ path: `${screenshotDir}/demo-mode-mobile.png`, fullPage: true });
    await mobile.context.close();
    await trpc(coordinator.page, "demo.reset", undefined);
    console.log(JSON.stringify({ publicId: incidentId, detectedStage: detected.stage, paused: true, mapMoved: true, completed: complete.status === "completed", demoNotices: demoNotices.length, resetCycles: 10, mobileOverflow }));
  } finally {
    await citizen.context.close();
    await volunteer.context.close();
    await coordinator.context.close();
  }
} finally {
  await browser.close();
}
