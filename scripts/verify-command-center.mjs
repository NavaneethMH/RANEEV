import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const outputDir = "/home/ubuntu/raneev-command-center-screenshots";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });

async function signInAndOpen(page) {
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email or phone").fill("coordinator.demo@raneev.test");
  await page.getByLabel("Password").fill("Raneev!Coord26");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/coordinator$/);
  const main = page.getByRole("main");
  await main.getByText("Active emergencies", { exact: false }).waitFor();
  await main.getByText("Live map", { exact: true }).waitFor();
  await main.getByText("Active incidents", { exact: true }).waitFor();
  await main.getByText("Incident timeline", { exact: true }).waitFor();
  await page.locator(".gm-style").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2_000);
}

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const desktop = await desktopContext.newPage();
  await signInAndOpen(desktop);
  await desktop.screenshot({ path: `${outputDir}/command-center-desktop.png`, fullPage: true });
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobile = await mobileContext.newPage();
  await signInAndOpen(mobile);
  const hasHorizontalOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (hasHorizontalOverflow) throw new Error("Coordinator command center has horizontal overflow at 375 px.");
  await mobile.screenshot({ path: `${outputDir}/command-center-mobile.png`, fullPage: true });
  await mobileContext.close();
  console.log("Coordinator command center desktop and mobile flows verified");
} finally {
  await browser.close();
}
