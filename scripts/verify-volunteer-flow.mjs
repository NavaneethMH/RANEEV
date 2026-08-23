import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const screenshotDir = process.env.RANEEV_SCREENSHOT_DIR ?? "/home/ubuntu/raneev-volunteer-flow-screenshots";
const viewport = process.env.RANEEV_MOBILE === "1" ? { width: 375, height: 812 } : { width: 1280, height: 900 };
const password = "Raneev!QaVolunteer26";
await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });

async function trpc(page, procedure, input) {
  const response = await page.evaluate(async ({ procedure, input }) => {
    const queries = new Set(["volunteer.readiness", "volunteer.nearbyIncidents", "volunteer.activeIncident"]);
    const query = queries.has(procedure);
    const url = query ? `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : `/api/trpc/${procedure}`;
    const result = await fetch(url, query ? { method: "GET" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
    return { status: result.status, text: await result.text() };
  }, { procedure, input });
  const parsed = JSON.parse(response.text);
  if (response.status >= 400 || parsed.error) throw new Error(parsed.error?.json?.message ?? `tRPC ${procedure} failed`);
  const data = parsed.result?.data;
  return data && typeof data === "object" && "json" in data ? data.json : data ?? parsed;
}

async function login(page, email, loginPassword, destination) {
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email or phone").fill(email);
  await page.getByLabel("Password").fill(loginPassword);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/(citizen|volunteer)(?:\/|$)/, { timeout: 15_000 });
  if (destination) await page.goto(`${baseURL}${destination}`, { waitUntil: "domcontentloaded" });
}

try {
  const citizenContext = await browser.newContext({ viewport, geolocation: { latitude: 13.1987, longitude: 77.7104 }, permissions: ["geolocation"] });
  const volunteerContext = await browser.newContext({ viewport, geolocation: { latitude: 13.1987, longitude: 77.7104 }, permissions: ["geolocation"] });
  const citizen = await citizenContext.newPage();
  const volunteer = await volunteerContext.newPage();
  const qaEmail = `qa.volunteer.${Date.now()}@raneev.test`;
  try {
    await login(citizen, "registration.test@raneev.test", "Raneev!Register26", "/citizen");
    await volunteer.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
    await trpc(volunteer, "auth.register", { name: "QA Volunteer Fixture", email: qaEmail, password, role: "volunteer" });
    await trpc(volunteer, "volunteer.completeDevelopmentVerification", undefined);
    await volunteer.goto(`${baseURL}/volunteer`, { waitUntil: "domcontentloaded" });
    await volunteer.getByRole("link", { name: "GO AVAILABLE" }).waitFor({ timeout: 12_000 });
    await volunteer.screenshot({ path: join(screenshotDir, "01-volunteer-dashboard.png"), fullPage: true });

    const incident = await trpc(citizen, "incidents.create", { emergencyType: "medical", locationLabel: "QA Volunteer test fixture", latitude: 13.1988, longitude: 77.7105, accuracyMeters: 12, description: "Controlled QA fixture for Volunteer workflow validation." });
    await volunteer.getByRole("link", { name: "GO AVAILABLE" }).click();
    await volunteer.waitForURL(/\/volunteer\/availability$/);
    await volunteer.getByRole("button", { name: "GO AVAILABLE" }).click();
    await volunteer.waitForURL(/\/volunteer\/nearby$/);
    const card = volunteer.locator("section").filter({ hasText: incident.publicId });
    await card.getByRole("button", { name: "Accept response request" }).click();
    await volunteer.waitForURL(/\/volunteer\/active$/);
    await volunteer.waitForTimeout(500);
    await volunteer.screenshot({ path: join(screenshotDir, "02-accepted-navigation.png"), fullPage: true });
    await volunteer.getByRole("button", { name: "Start navigation" }).click();
    await volunteer.getByRole("button", { name: "Mark as arrived" }).waitFor({ timeout: 12_000 });
    await volunteer.getByRole("button", { name: "Mark as arrived" }).click();
    await volunteer.getByRole("button", { name: "Begin assistance" }).waitFor({ timeout: 12_000 });
    await volunteer.screenshot({ path: join(screenshotDir, "03-arrived.png"), fullPage: true });
    await volunteer.getByRole("button", { name: "Begin assistance" }).click();
    await volunteer.getByRole("button", { name: "Resolve incident" }).waitFor({ timeout: 12_000 });
    await volunteer.screenshot({ path: join(screenshotDir, "04-assisting.png"), fullPage: true });
    await volunteer.getByRole("button", { name: "Resolve incident" }).click();
    await volunteer.waitForURL(/\/volunteer\/history$/);
    await volunteer.screenshot({ path: join(screenshotDir, "05-resolved-history.png"), fullPage: true });
    const active = await trpc(volunteer, "volunteer.activeIncident", undefined);
    if (active !== null) throw new Error("Resolved QA fixture remained active for the Volunteer.");
    console.log(JSON.stringify({ qaEmail, publicId: incident.publicId, resolved: true }));
  } finally {
    await citizenContext.close();
    await volunteerContext.close();
  }
} finally {
  await browser.close();
}
