import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const outputDir = process.env.RANEEV_UX_AUDIT_DIR ?? "/home/ubuntu/raneev-ux-audit";
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });

async function login(context, email, password) {
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email or phone").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/(citizen|volunteer|coordinator|admin)(?:\/|$)/, { timeout: 15_000 });
  return page;
}

async function trpc(page, procedure, input) {
  const response = await page.evaluate(async ({ procedure, input }) => {
    const query = procedure === "demo.status";
    const url = query ? `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : `/api/trpc/${procedure}`;
    const result = await fetch(url, query ? { method: "GET" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
    return { status: result.status, text: await result.text() };
  }, { procedure, input });
  const parsed = JSON.parse(response.text);
  if (response.status >= 400 || parsed.error) throw new Error(parsed.error?.json?.message ?? `tRPC ${procedure} failed`);
  return parsed.result?.data?.json ?? parsed.result?.data ?? parsed;
}

async function moveDemoTo(page, stage) {
  const order = ["new_emergency", "responder_detected", "responder_accepted", "responder_moving", "responder_arrived", "incident_resolved"];
  let status = await trpc(page, "demo.status", undefined);
  while (order.indexOf(status.stage) < order.indexOf(stage)) status = await trpc(page, "demo.skip", undefined);
  return status;
}

async function inspect(page, name, path, viewport, screenshot = false) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll('button, a[href], input, textarea, select').length > 0, undefined, { timeout: 15_000 });
  await page.waitForTimeout(180);
  const metrics = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll('button, a[href], input, textarea, select'));
    const small = controls.flatMap(node => {
      const r = node.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || (r.width >= 40 && r.height >= 40)) return [];
      return [{ label: (node.getAttribute('aria-label') || node.textContent || '').trim().slice(0, 64), width: Math.round(r.width), height: Math.round(r.height) }];
    });
    const headings = Array.from(document.querySelectorAll('h1, h2')).map(node => node.textContent?.trim()).filter(Boolean);
    const nav = Array.from(document.querySelectorAll('nav a, aside a')).map(node => node.textContent?.trim()).filter(Boolean);
    const errorAlerts = document.querySelectorAll('[role="alert"]').length;
    return { overflow: document.documentElement.scrollWidth > window.innerWidth, controls: controls.length, smallTargets: small, headings, navCount: nav.length, errorAlerts };
  });
  if (screenshot) await page.screenshot({ path: join(outputDir, `${name.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`), fullPage: true });
  return { name, path, width: viewport.width, ...metrics };
}

try {
  const publicContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const citizenContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, geolocation: { latitude: 12.9718, longitude: 77.5948 }, permissions: ["geolocation"] });
  const volunteerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, geolocation: { latitude: 12.9718, longitude: 77.5948 }, permissions: ["geolocation"] });
  const coordinatorContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const publicPage = await publicContext.newPage();
  const citizen = await login(citizenContext, "citizen.demo@raneev.test", "Raneev!Citizen26");
  const volunteer = await login(volunteerContext, "volunteer.demo@raneev.test", "Raneev!Volunteer26");
  const coordinator = await login(coordinatorContext, "coordinator.demo@raneev.test", "Raneev!Coord26");
  const admin = await login(adminContext, "admin.demo@raneev.test", "Raneev!Admin26");
  const results = [];
  try {
    await trpc(coordinator, "demo.reset", undefined);
    const started = await trpc(coordinator, "demo.start", undefined);
    const moving = await moveDemoTo(coordinator, "responder_moving");
    if (!started.incident?.publicId || moving.stage !== "responder_moving") throw new Error("Could not prepare the controlled Demo Mode audit state.");
    const publicScreens = [["landing", "/"], ["login", "/login"], ["registration", "/register"], ["role-routing", "/roles"], ["access-denied", "/access-denied"]];
    const citizenScreens = [["citizen-home", "/citizen"], ["citizen-report", "/citizen/report"], ["citizen-confirm", "/citizen/confirm"], ["citizen-live", `/citizen/live/${started.incident.publicId}`], ["citizen-history", "/citizen/history"], ["citizen-profile", "/citizen/profile"]];
    const volunteerScreens = [["volunteer-home", "/volunteer"], ["volunteer-availability", "/volunteer/availability"], ["volunteer-nearby", "/volunteer/nearby"], ["volunteer-active", "/volunteer/active"], ["volunteer-history", "/volunteer/history"], ["volunteer-profile", "/volunteer/profile"]];
    const coordinatorScreens = [["command-center", "/coordinator"], ["ghr-queue", "/coordinator/ghr"], ["incident-list", "/coordinator/incidents"], ["incident-detail", "/coordinator/details"], ["coordinator-map", "/coordinator/map"], ["responder-management", "/coordinator/responders"], ["coordinator-analytics", "/coordinator/analytics"], ["demo-mode", "/demo"]];
    const adminScreens = [["admin-home", "/admin"], ["admin-users", "/admin/users"], ["admin-verification", "/admin/verification"], ["admin-incidents", "/admin/incidents"], ["admin-audit", "/admin/audit"], ["admin-ai", "/admin/ai"], ["admin-notifications", "/admin/notifications"]];
    for (const [name, path] of publicScreens) results.push(await inspect(publicPage, name, path, { width: 1440, height: 1000 }, true));
    for (const [name, path] of citizenScreens) results.push(await inspect(citizen, name, path, { width: 1440, height: 1000 }, true));
    for (const [name, path] of volunteerScreens) results.push(await inspect(volunteer, name, path, { width: 1440, height: 1000 }, true));
    for (const [name, path] of coordinatorScreens) results.push(await inspect(coordinator, name, path, { width: 1440, height: 1000 }, true));
    for (const [name, path] of adminScreens) results.push(await inspect(admin, name, path, { width: 1440, height: 1000 }, true));
    const mobileAnchors = [
      [publicPage, "mobile-landing", "/"], [citizen, "mobile-citizen-report", "/citizen/report"], [citizen, "mobile-citizen-live", `/citizen/live/${started.incident.publicId}`],
      [volunteer, "mobile-volunteer-availability", "/volunteer/availability"], [volunteer, "mobile-volunteer-active", "/volunteer/active"],
      [coordinator, "mobile-command-center", "/coordinator"], [coordinator, "mobile-ghr-queue", "/coordinator/ghr"], [coordinator, "mobile-demo", "/demo"],
      [admin, "mobile-admin-home", "/admin"], [admin, "mobile-admin-verification", "/admin/verification"], [admin, "mobile-admin-audit", "/admin/audit"],
    ];
    for (const [page, name, path] of mobileAnchors) results.push(await inspect(page, name, path, { width: 375, height: 812 }, true));
    const overflow = results.filter(result => result.overflow).map(result => result.name);
    const smallTargets = results.filter(result => result.smallTargets.length).map(result => ({ name: result.name, smallTargets: result.smallTargets }));
    console.log(JSON.stringify({ auditedScreens: results.length, desktopScreens: 32, mobileAnchors: mobileAnchors.length, overflow, smallTargetScreens: smallTargets, outputDir, results }, null, 2));
  } finally {
    try { await trpc(coordinator, "demo.reset", undefined); } catch { /* preserve cleanup */ }
    await Promise.all([publicContext.close(), citizenContext.close(), volunteerContext.close(), coordinatorContext.close(), adminContext.close()]);
  }
} finally {
  await browser.close();
}
