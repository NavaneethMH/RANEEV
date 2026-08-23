import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const incidentId = process.env.GHR_INCIDENT_ID;
if (!incidentId) throw new Error("GHR_INCIDENT_ID is required for mobile Golden Hour verification.");
const outputDir = "/home/ubuntu/raneev-ghr-mobile-screenshots";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await context.newPage();

try {
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email or phone").fill("coordinator.demo@raneev.test");
  await page.getByLabel("Password").fill("Raneev!Coord26");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/coordinator$/);
  await page.goto(`${baseURL}/coordinator/ghr/${incidentId}`, { waitUntil: "networkidle" });
  await page.getByText("Time since incident", { exact: false }).waitFor();
  await page.screenshot({ path: `${outputDir}/ghr-mobile-sequence.png`, fullPage: true });
  const overflow = await page.evaluate(() => ({
    hasOverflow: document.documentElement.scrollWidth > window.innerWidth,
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    offenders: Array.from(document.querySelectorAll("body *")).flatMap(element => {
      const rect = element.getBoundingClientRect();
      return rect.right > window.innerWidth + 1 || rect.left < -1 ? [{ tag: element.tagName, className: element.className, right: Math.round(rect.right), left: Math.round(rect.left) }] : [];
    }).slice(0, 8),
    ancestors: (() => {
      const element = document.querySelector(".space-y-6");
      const items = [];
      let current = element;
      while (current && items.length < 8) {
        const rect = current.getBoundingClientRect();
        items.push({ tag: current.tagName, className: current.className, width: Math.round(rect.width), right: Math.round(rect.right) });
        current = current.parentElement;
      }
      return items;
    })(),
    devicePixelRatio: window.devicePixelRatio,
    visualScale: window.visualViewport?.scale,
  }));
  if (overflow.hasOverflow) throw new Error(`Golden Hour mobile view has horizontal overflow: ${JSON.stringify(overflow)}`);
  console.log("Golden Hour Response mobile flow verified");
} finally {
  await context.close();
  await browser.close();
}
