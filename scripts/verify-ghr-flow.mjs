import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const incidentId = process.env.GHR_INCIDENT_ID;
const outputDir = "/home/ubuntu/raneev-ghr-flow-screenshots";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

try {
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email or phone").fill("coordinator.demo@raneev.test");
  await page.getByLabel("Password").fill("Raneev!Coord26");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/coordinator$/);
  if (incidentId) await page.goto(`${baseURL}/coordinator/ghr/${incidentId}`, { waitUntil: "networkidle" });
  else {
    await page.goto(`${baseURL}/coordinator/ghr`, { waitUntil: "networkidle" });
    const incidentLink = page.locator('a[href^="/coordinator/ghr/"]').first();
    await incidentLink.waitFor();
    await incidentLink.click();
  }
  await page.getByText("Time since incident", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Urgent" }).click();
  await page.getByText("Searching authorized nearby hospital options…").waitFor({ state: "hidden", timeout: 30_000 });
  const candidate = page.getByRole("button", { name: /Plan incident-to-facility route/ }).first();
  await candidate.waitFor({ timeout: 30_000 });
  await candidate.click();
  const confirmFacility = page.getByRole("button", { name: /^Confirm .* · \d+ min/ });
  await confirmFacility.waitFor({ timeout: 30_000 });
  await confirmFacility.click();
  await page.getByRole("button", { name: "Record professional-service contact" }).click();
  await page.screenshot({ path: `${outputDir}/ghr-operational-sequence.png`, fullPage: true });
  console.log("Golden Hour Response browser flow verified");
} finally {
  await context.close();
  await browser.close();
}
