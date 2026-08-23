import { chromium } from "playwright";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
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

async function verifyPage(page, label, path, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll('button, a[href], input, textarea, select').length > 0, undefined, { timeout: 12_000 });
  const result = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth, actionable: document.querySelectorAll('button, a[href], input, textarea, select').length }));
  if (result.overflow) throw new Error(`${label} overflowed at ${width}px (${path}).`);
  if (!result.actionable) throw new Error(`${label} had no reachable interactive controls at ${width}px (${path}).`);
}

try {
  const publicContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const publicPage = await publicContext.newPage();
  const citizenContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const volunteerContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, geolocation: { latitude: 12.9718, longitude: 77.5948 }, permissions: ["geolocation"] });
  const coordinatorContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const citizen = await login(citizenContext, "citizen.demo@raneev.test", "Raneev!Citizen26");
  const volunteer = await login(volunteerContext, "volunteer.demo@raneev.test", "Raneev!Volunteer26");
  const coordinator = await login(coordinatorContext, "coordinator.demo@raneev.test", "Raneev!Coord26");
  const admin = await login(adminContext, "admin.demo@raneev.test", "Raneev!Admin26");
  try {
    let cases = 0;
    for (const width of widths) {
      await verifyPage(publicPage, "Landing", "/", width);
      await verifyPage(publicPage, "Login", "/login", width);
      await verifyPage(citizen, "Citizen dashboard", "/citizen", width);
      await verifyPage(citizen, "Emergency report", "/citizen/report", width);
      await verifyPage(volunteer, "Volunteer dashboard", "/volunteer", width);
      await verifyPage(volunteer, "Volunteer availability", "/volunteer/availability", width);
      await verifyPage(coordinator, "Command center", "/coordinator", width);
      await verifyPage(coordinator, "Demo Mode", "/demo", width);
      await verifyPage(admin, "Admin dashboard", "/admin", width);
      cases += 9;
    }
    console.log(JSON.stringify({ widths, checkedCases: cases, overflow: false }));
  } finally {
    await Promise.all([publicContext.close(), citizenContext.close(), volunteerContext.close(), coordinatorContext.close(), adminContext.close()]);
  }
} finally {
  await browser.close();
}
