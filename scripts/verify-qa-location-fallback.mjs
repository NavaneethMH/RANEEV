import { chromium } from "playwright";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });

async function login(page, email, password) {
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email or phone").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/(citizen|volunteer)(?:\/|$)/, { timeout: 15_000 });
}

try {
  const citizenContext = await browser.newContext({ permissions: [] });
  const volunteerContext = await browser.newContext({ permissions: [] });
  const citizen = await citizenContext.newPage();
  const volunteer = await volunteerContext.newPage();
  try {
    await login(citizen, "citizen.demo@raneev.test", "Raneev!Citizen26");
    await citizen.goto(`${baseURL}/citizen/report`, { waitUntil: "domcontentloaded" });
    await citizen.getByRole("button", { name: /Road accident/ }).click();
    await citizen.getByRole("button", { name: /Continue to location/ }).click();
    await citizen.getByRole("button", { name: "Use current location" }).click();
    await citizen.getByText(/Current location is unavailable|confirmed location/i).last().waitFor({ timeout: 12_000 });
    await login(volunteer, "volunteer.demo@raneev.test", "Raneev!Volunteer26");
    await volunteer.goto(`${baseURL}/volunteer/availability`, { waitUntil: "domcontentloaded" });
    await volunteer.getByRole("button", { name: "GO AVAILABLE" }).click();
    await volunteer.getByText(/Allow location access|location could not/i).first().waitFor({ timeout: 12_000 });
    console.log(JSON.stringify({ citizenLocationFallback: true, volunteerLocationDenied: true }));
  } finally { await citizenContext.close(); await volunteerContext.close(); }
} finally { await browser.close(); }
