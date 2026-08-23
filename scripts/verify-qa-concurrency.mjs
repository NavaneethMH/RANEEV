import { chromium } from "playwright";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
const suffix = Date.now();
const password = "Raneev!QaConcurrent26";

async function raw(page, procedure, input, query = false) {
  return page.evaluate(async ({ procedure, input, query }) => {
    const url = query ? `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : `/api/trpc/${procedure}`;
    const response = await fetch(url, query ? { method: "GET" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
    return { status: response.status, body: JSON.parse(await response.text()) };
  }, { procedure, input, query });
}

async function trpc(page, procedure, input, query = false) {
  const response = await raw(page, procedure, input, query);
  if (response.status >= 400 || response.body.error) throw new Error(response.body.error?.json?.message ?? `tRPC ${procedure} failed`);
  const data = response.body.result?.data;
  return data && typeof data === "object" && "json" in data ? data.json : data ?? response.body;
}

async function createPage() {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  return { context, page };
}

async function register(page, name, email, role) {
  return trpc(page, "auth.register", { name, email, password, role });
}

try {
  const citizen = await createPage();
  const volunteerOne = await createPage();
  const volunteerTwo = await createPage();
  try {
    await register(citizen.page, "QA Concurrency Citizen", `qa.concurrent.citizen.${suffix}@raneev.test`, "citizen");
    await Promise.all([
      register(volunteerOne.page, "QA Concurrency Volunteer One", `qa.concurrent.one.${suffix}@raneev.test`, "volunteer"),
      register(volunteerTwo.page, "QA Concurrency Volunteer Two", `qa.concurrent.two.${suffix}@raneev.test`, "volunteer"),
    ]);
    await Promise.all([
      trpc(volunteerOne.page, "volunteer.completeDevelopmentVerification", undefined),
      trpc(volunteerTwo.page, "volunteer.completeDevelopmentVerification", undefined),
    ]);
    await Promise.all([
      trpc(volunteerOne.page, "volunteer.setAvailability", { availability: "available", latitude: 12.9718, longitude: 77.5948 }),
      trpc(volunteerTwo.page, "volunteer.setAvailability", { availability: "available", latitude: 12.9719, longitude: 77.5949 }),
    ]);
    const incident = await trpc(citizen.page, "incidents.create", { emergencyType: "medical", locationLabel: "QA concurrent acceptance fixture", latitude: 12.9717, longitude: 77.5947, accuracyMeters: 8, description: "Controlled concurrent acceptance validation." });
    const attempts = await Promise.allSettled([
      trpc(volunteerOne.page, "volunteer.accept", { publicId: incident.publicId }),
      trpc(volunteerTwo.page, "volunteer.accept", { publicId: incident.publicId }),
    ]);
    const fulfilled = attempts.filter(attempt => attempt.status === "fulfilled");
    const rejected = attempts.filter(attempt => attempt.status === "rejected");
    if (fulfilled.length !== 1 || rejected.length !== 1) throw new Error(`Atomic assignment failure: ${fulfilled.length} fulfilled, ${rejected.length} rejected.`);
    const winningPage = attempts[0].status === "fulfilled" ? volunteerOne.page : volunteerTwo.page;
    await trpc(winningPage, "volunteer.startRoute", { publicId: incident.publicId });
    await trpc(winningPage, "volunteer.arrive", { publicId: incident.publicId });
    await trpc(winningPage, "volunteer.resolve", { publicId: incident.publicId });
    console.log(JSON.stringify({ publicId: incident.publicId, atomicAssignment: true, fulfilled: fulfilled.length, rejected: rejected.length, resolved: true }));
  } finally {
    await Promise.all([citizen.context.close(), volunteerOne.context.close(), volunteerTwo.context.close()]);
  }
} finally {
  await browser.close();
}
