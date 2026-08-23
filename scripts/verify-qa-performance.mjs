import { chromium } from "playwright";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const observationMs = 4_200;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });

async function login(email, password, destination) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, geolocation: { latitude: 12.9718, longitude: 77.5948 }, permissions: ["geolocation"] });
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email or phone").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/(citizen|coordinator)(?:\/|$)/, { timeout: 15_000 });
  await page.goto(`${baseURL}${destination}`, { waitUntil: "domcontentloaded" });
  return { context, page };
}

async function trpc(page, procedure, input) {
  const response = await page.evaluate(async ({ procedure, input }) => {
    const queries = new Set(["demo.status"]);
    const query = queries.has(procedure);
    const url = query ? `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : `/api/trpc/${procedure}`;
    const result = await fetch(url, query ? { method: "GET" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
    return { status: result.status, text: await result.text() };
  }, { procedure, input });
  const parsed = JSON.parse(response.text);
  if (response.status >= 400 || parsed.error) throw new Error(parsed.error?.json?.message ?? `tRPC ${procedure} failed`);
  return parsed.result?.data?.json ?? parsed.result?.data ?? parsed;
}

async function skipTo(page, stage) {
  const order = ["new_emergency", "responder_detected", "responder_accepted", "responder_moving", "responder_arrived", "incident_resolved"];
  let state = await trpc(page, "demo.status", undefined);
  while (order.indexOf(state.stage) < order.indexOf(stage)) state = await trpc(page, "demo.skip", undefined);
  return state;
}

function classify(url) {
  const normalized = decodeURIComponent(url).toLowerCase();
  if (normalized.includes("/api/trpc/demo.status")) return "demoStatus";
  if (normalized.includes("/api/trpc/incidents.mapsnapshot")) return "mapSnapshot";
  if (normalized.includes("directionsservice.route")) return "directions";
  if (/(googleapis\.com|google\.com\/maps|maps\.gstatic\.com)/.test(normalized)) return "otherGoogleMap";
  if (normalized.includes("/api/trpc/")) return "otherTrpc";
  return "other";
}

function summarize(urls) {
  return urls.reduce((summary, url) => ({ ...summary, [classify(url)]: (summary[classify(url)] ?? 0) + 1 }), {});
}

try {
  const coordinator = await login("coordinator.demo@raneev.test", "Raneev!Coord26", "/demo");
  const citizen = await login("citizen.demo@raneev.test", "Raneev!Citizen26", "/citizen");
  try {
    await trpc(coordinator.page, "demo.reset", undefined);
    const started = await trpc(coordinator.page, "demo.start", undefined);
    const moving = await skipTo(coordinator.page, "responder_moving");
    if (moving.stage !== "responder_moving" || !started.incident?.publicId) throw new Error("Demo Mode did not reach responder movement for performance observation.");

    const coordinatorRequests = [];
    coordinator.page.on("request", request => coordinatorRequests.push({ url: request.url(), at: Date.now() }));
    await coordinator.page.goto(`${baseURL}/demo`, { waitUntil: "domcontentloaded" });
    await coordinator.page.getByText("Presenter controls", { exact: false }).waitFor({ timeout: 12_000 });
    await coordinator.page.waitForTimeout(1_250);
    coordinatorRequests.length = 0;
    await coordinator.page.waitForTimeout(observationMs);
    const coordinatorSteadyRequests = coordinatorRequests.slice();

    const citizenRequests = [];
    citizen.page.on("request", request => citizenRequests.push({ url: request.url(), at: Date.now() }));
    await citizen.page.goto(`${baseURL}/citizen/live/${started.incident.publicId}`, { waitUntil: "domcontentloaded" });
    await citizen.page.waitForFunction(() => window.__raneevMapTelemetry?.directionsCalls === 1, undefined, { timeout: 15_000 });
    const routeInvocationsAtMount = await citizen.page.evaluate(() => window.__raneevMapTelemetry?.directionsCalls ?? 0);
    await citizen.page.waitForTimeout(observationMs);
    const routeInvocationsAfterObservation = await citizen.page.evaluate(() => window.__raneevMapTelemetry?.directionsCalls ?? 0);

    const coordinatorCounts = summarize(coordinatorSteadyRequests.map(request => request.url));
    const citizenCounts = summarize(citizenRequests.map(request => request.url));
    const demoStatusPolls = coordinatorCounts.demoStatus ?? 0;
    const directionsRequests = citizenCounts.directions ?? 0;
    const mapSnapshotPolls = citizenCounts.mapSnapshot ?? 0;
    const demoStatusOffsets = coordinatorSteadyRequests.filter(request => classify(request.url) === "demoStatus").map(request => request.at - coordinatorSteadyRequests[0].at);
    const directionsUrls = citizenRequests.filter(request => classify(request.url) === "directions").map(request => request.url);
    if (demoStatusPolls < 3 || demoStatusPolls > 5) throw new Error(`Demo status polling was not bounded near one request per second (${demoStatusPolls} over ${observationMs}ms after initial hydration).`);
    console.log(JSON.stringify({ observationMs, publicId: started.incident.publicId, demoStatusPolls, demoStatusOffsets, mapSnapshotPolls, directionsRequests, routeInvocationsAtMount, routeInvocationsAfterObservation, coordinatorRequests: coordinatorCounts, citizenRequests: citizenCounts, directionsUrls }));
    if (directionsRequests > 1) throw new Error(`Demo responder movement repeated Google Maps directions traffic (${directionsRequests} requests).`);
    if (mapSnapshotPolls > 2) throw new Error(`Citizen live map snapshot polling exceeded its bounded interval (${mapSnapshotPolls} requests).`);
    if (routeInvocationsAtMount !== 1 || routeInvocationsAfterObservation !== 1) throw new Error(`Fixed Demo route was not reused during live movement (${routeInvocationsAtMount} initial, ${routeInvocationsAfterObservation} after observation).`);

  } finally {
    try { await trpc(coordinator.page, "demo.reset", undefined); } catch { /* Preserve cleanup even if the observation assertion failed. */ }
    await citizen.context.close();
    await coordinator.context.close();
  }
} finally {
  await browser.close();
}
