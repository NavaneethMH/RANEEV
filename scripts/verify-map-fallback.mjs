import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const screenshotDir = process.env.RANEEV_SCREENSHOT_DIR ?? "/home/ubuntu/raneev-map-fallback-screenshots";
const viewport = process.env.RANEEV_MOBILE === "1" ? { width: 375, height: 812 } : { width: 1280, height: 900 };
await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
const page = await browser.newPage({ viewport });

try {
  await page.route("**/v1/maps/proxy/**", route => route.abort());
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email or phone").fill("registration.test@raneev.test");
  await page.getByLabel("Password").fill("Raneev!Register26");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/citizen$/);
  await page.getByRole("link", { name: "Request emergency help" }).click();
  await page.getByRole("button", { name: /Continue to location/ }).click();
  await page.waitForURL(/\/citizen\/confirm$/);
  await page.getByText("Map temporarily unavailable").waitFor();
  await page.screenshot({ path: join(screenshotDir, "degraded-map-fallback.png"), fullPage: true });
  console.log(`Map fallback screenshot written to ${screenshotDir}`);
} finally {
  await browser.close();
}
