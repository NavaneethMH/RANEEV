import { chromium } from "playwright";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
const suffix = `${Date.now()}`;
const password = "Raneev!QaSecurity26";

async function rawTrpc(page, procedure, input, query = false) {
  return page.evaluate(async ({ procedure, input, query }) => {
    const url = query ? `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : `/api/trpc/${procedure}`;
    const response = await fetch(url, query ? { method: "GET" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
    return { status: response.status, body: JSON.parse(await response.text()) };
  }, { procedure, input, query });
}

async function trpc(page, procedure, input, query = false) {
  const response = await rawTrpc(page, procedure, input, query);
  if (response.status >= 400 || response.body.error) throw new Error(response.body.error?.json?.message ?? `tRPC ${procedure} failed`);
  const data = response.body.result?.data;
  return data && typeof data === "object" && "json" in data ? data.json : data ?? response.body;
}

async function register(page, name, email) {
  return trpc(page, "auth.register", { name, email, password, role: "citizen" });
}

try {
  const anonymous = await browser.newPage();
  await anonymous.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  const unauthenticated = await rawTrpc(anonymous, "incidents.active", undefined, true);
  if (!unauthenticated.body.error || ![401, 403].includes(unauthenticated.status)) throw new Error("Unauthenticated incident access was not rejected.");
  const malformedRegistration = await rawTrpc(anonymous, "auth.register", { name: "A", email: "not-an-email", password: "weak", role: "admin" });
  if (!malformedRegistration.body.error) throw new Error("Malformed registration was accepted.");

  const citizenA = await browser.newPage();
  const citizenB = await browser.newPage();
  const emailA = `qa.security.a.${suffix}@raneev.test`;
  const emailB = `qa.security.b.${suffix}@raneev.test`;
  try {
    await Promise.all([
      citizenA.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" }),
      citizenB.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" }),
    ]);
    const registeredA = await register(citizenA, "QA Security Citizen A", emailA);
    if (registeredA.role !== "citizen") throw new Error("Valid citizen registration did not return the expected role.");
    const duplicate = await rawTrpc(citizenA, "auth.register", { name: "QA Duplicate", email: emailA, password, role: "citizen" });
    if (!duplicate.body.error || !/already exists/i.test(duplicate.body.error.json?.message ?? "")) throw new Error("Duplicate registration was not safely rejected.");
    const incident = await trpc(citizenA, "incidents.create", { emergencyType: "medical", locationLabel: "QA security ownership fixture", latitude: 12.9716, longitude: 77.5946, accuracyMeters: 10, description: "Controlled authorization test fixture." });
    const oversized = await rawTrpc(citizenA, "incidents.create", { emergencyType: "medical", locationLabel: "QA validation fixture", latitude: 12.9716, longitude: 77.5946, accuracyMeters: 10, description: "x".repeat(501) });
    const invalidCoordinates = await rawTrpc(citizenA, "incidents.create", { emergencyType: "medical", locationLabel: "QA validation fixture", latitude: 190, longitude: 77.5946, accuracyMeters: 10 });
    if (!oversized.body.error || !invalidCoordinates.body.error) throw new Error("Oversized or invalid coordinate incident input was accepted.");

    await register(citizenB, "QA Security Citizen B", emailB);
    const foreignIncident = await rawTrpc(citizenB, "incidents.byPublicId", { publicId: incident.publicId }, true);
    const roleEscalation = await rawTrpc(citizenB, "admin.updateRole", { userId: registeredA.id, role: "admin" });
    if (!foreignIncident.body.error || ![403, 404].includes(foreignIncident.status)) throw new Error("A citizen could access another citizen's incident.");
    if (!roleEscalation.body.error || ![401, 403].includes(roleEscalation.status)) throw new Error("Citizen role escalation API attempt was not rejected.");

    const xss = "<img src=x onerror=window.__raneevQaXss=true>";
    await trpc(citizenB, "profile.update", { name: xss, phone: null });
    await citizenB.goto(`${baseURL}/citizen/profile`, { waitUntil: "domcontentloaded" });
    const executedXss = await citizenB.evaluate(() => Boolean((window).__raneevQaXss) || document.querySelector('img[onerror*="raneevQaXss"]') !== null);
    if (executedXss) throw new Error("Profile input executed as markup in the Citizen workspace.");

    await trpc(citizenA, "auth.logout", undefined);
    const afterLogout = await rawTrpc(citizenA, "incidents.active", undefined, true);
    if (!afterLogout.body.error || ![401, 403].includes(afterLogout.status)) throw new Error("Protected incident endpoint remained available after logout.");
    const invalidLogin = await rawTrpc(anonymous, "auth.login", { email: emailA, password: "WrongPassword!26" });
    if (!invalidLogin.body.error || /not found|hash|stack/i.test(invalidLogin.body.error.json?.message ?? "")) throw new Error("Invalid login exposed account internals.");
    console.log(JSON.stringify({ unauthenticatedProtectedApi: true, invalidRegistrationRejected: true, duplicateRejected: true, ownershipDenied: true, roleEscalationDenied: true, inputValidationRejected: true, renderedXssSafe: true, logoutRevoked: true, invalidLoginGeneric: true }));
  } finally {
    await citizenA.close();
    await citizenB.close();
  }
} finally {
  await browser.close();
}
