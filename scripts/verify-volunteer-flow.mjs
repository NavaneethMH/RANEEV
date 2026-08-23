import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const screenshotDir = process.env.RANEEV_SCREENSHOT_DIR ?? "/home/ubuntu/raneev-volunteer-flow-screenshots";
const viewport = process.env.RANEEV_MOBILE === "1" ? { width: 375, height: 812 } : { width: 1280, height: 900 };
await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
const context = await browser.newContext({ viewport, geolocation: { latitude: 13.1987, longitude: 77.7104 }, permissions: ["geolocation"] });
const page = await context.newPage();
const capture = async name => page.screenshot({ path: join(screenshotDir, `${name}.png`), fullPage: true });

try {
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email or phone").fill("volunteer.demo@raneev.test");
  await page.getByLabel("Password").fill("Raneev!Volunteer26");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/volunteer$/);
  await capture("01-volunteer-dashboard");
  await page.getByRole("link", { name: "GO AVAILABLE" }).click();
  await page.waitForURL(/\/volunteer\/availability$/);
  await page.getByRole("button", { name: "GO AVAILABLE" }).click();
  await page.waitForURL(/\/volunteer\/nearby$/);
  await page.getByRole("button", { name: "Accept response request" }).click();
  await page.waitForURL(/\/volunteer\/active$/);
  await page.waitForTimeout(1000);
  await capture("02-accepted-navigation");
  await page.getByRole("button", { name: "Start navigation" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Mark as arrived" }).click();
  await page.waitForTimeout(500);
  await capture("03-arrived");
  await page.getByRole("button", { name: "Begin assistance" }).click();
  await page.waitForTimeout(500);
  await capture("04-assisting");
  await page.getByRole("button", { name: "Resolve incident" }).click();
  await page.waitForURL(/\/volunteer\/history$/);
  await capture("05-resolved-history");
  console.log(`Volunteer workflow screenshots written to ${screenshotDir}`);
} finally {
  await context.close();
  await browser.close();
}
