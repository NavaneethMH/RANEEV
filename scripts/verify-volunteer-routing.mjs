import { chromium } from "playwright";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
const context = await browser.newContext({ geolocation: { latitude: 13.199, longitude: 77.7106 }, permissions: ["geolocation"] });
const page = await context.newPage();

try {
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email or phone").fill("lock.volunteer@raneev.test");
  await page.getByLabel("Password").fill("Raneev!Lock27");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/volunteer$/);
  await page.goto(`${baseURL}/volunteer/accept`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/volunteer\/nearby$/);
  await page.goto(`${baseURL}/volunteer/assist`, { waitUntil: "networkidle" });
  await page.getByText("No active assignment.").waitFor();
  console.log("Volunteer accept redirect and assistance route verified");
} finally {
  await context.close();
  await browser.close();
}
