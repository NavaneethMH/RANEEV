import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const screenshotDir = process.env.RANEEV_SCREENSHOT_DIR ?? "/home/ubuntu/raneev-citizen-flow-screenshots";
const viewport = process.env.RANEEV_MOBILE === "1" ? { width: 375, height: 812 } : { width: 1280, height: 900 };
await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
const page = await browser.newPage({ viewport });

async function capture(name) {
  await page.screenshot({ path: join(screenshotDir, `${name}.png`), fullPage: true });
}

try {
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email or phone").fill("registration.test@raneev.test");
  await page.getByLabel("Password").fill("Raneev!Register26");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/citizen$/);
  await page.getByRole("link", { name: "Request emergency help" }).click();
  await page.waitForURL(/\/citizen\/report$/);
  await capture("01-emergency-type");
  await page.getByRole("button", { name: /Road accident/ }).click();
  await page.getByRole("button", { name: /Continue to location/ }).click();
  await page.waitForURL(/\/citizen\/confirm$/);
  await capture("02-location-and-description");
  await page.getByPlaceholder("Describe the immediate situation in a few words.").fill("Playwright golden-path validation request.");
  await page.getByRole("button", { name: "Confirm emergency request" }).click();
  await page.waitForURL(/\/citizen\/live\/ERN-/);
  await page.waitForTimeout(400);
  await capture("03-searching-for-responders");
  await page.getByRole("button", { name: "Simulate responder acceptance" }).click();
  await page.waitForTimeout(400);
  await capture("04-responder-accepted");
  await page.getByRole("button", { name: "Simulate responder departure" }).click();
  await page.waitForTimeout(400);
  await capture("05-live-tracking-en-route");
  await page.getByRole("button", { name: "Simulate help arrival" }).click();
  await page.waitForTimeout(400);
  await capture("06-help-arrived");
  await page.getByRole("button", { name: "Confirm incident resolved" }).click();
  await page.waitForTimeout(400);
  await capture("07-incident-resolved");
  console.log(`Citizen golden-path screenshots written to ${screenshotDir}`);
} finally {
  await browser.close();
}
