import { chromium } from "playwright";

const baseURL = process.env.RANEEV_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });

async function login(context, email, password) {
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email or phone").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(/\/(citizen|volunteer|coordinator|admin)(?:\/|$)/, { timeout: 15_000 });
  return page;
}

async function assess(page, path) {
  await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll('button, a[href], input, textarea, select').length > 0, undefined, { timeout: 12_000 });
  const statePreview = page.locator('summary').filter({ hasText: 'Resilient state treatment' }).first();
  if (await statePreview.count()) await statePreview.click();
  const summary = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll('button, a[href], input, textarea, select'));
    const unlabeled = controls.filter(node => node instanceof HTMLButtonElement && !node.textContent?.trim() && !node.getAttribute('aria-label') && !node.getAttribute('title')).length;
    const small = controls.flatMap(node => {
      const r = node.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || (r.width >= 32 && r.height >= 32)) return [];
      return [{ tag: node.tagName.toLowerCase(), label: (node.getAttribute('aria-label') || node.textContent || node.getAttribute('title') || '').trim().slice(0, 80), width: Math.round(r.width), height: Math.round(r.height), className: node.className }];
    });
    const statusLabels = Array.from(document.querySelectorAll('span')).filter(node => node.className.includes('min-h-7') && node.className.includes('font-extrabold')).map(node => node.textContent?.trim() ?? '').filter(Boolean);
    return { controls: controls.length, unlabeled, small, statusLabels };
  });
  await page.keyboard.press('Tab');
  const focusVisible = await page.evaluate(() => document.activeElement !== document.body && document.activeElement !== document.documentElement);
  if (!focusVisible || summary.unlabeled > 0) throw new Error(`${path} failed keyboard/focus or semantic-control labeling checks.`);
  const errorControl = page.getByRole('button', { name: 'Error' }).first();
  let errorMessageAccessible = false;
  if (await errorControl.count()) {
    await errorControl.click();
    errorMessageAccessible = await page.getByRole('alert').filter({ hasText: 'We could not complete this request. Your last verified state is unchanged.' }).count() > 0;
    if (!errorMessageAccessible) throw new Error(`${path} did not expose the operational error state as an accessible alert.`);
  }
  return { ...summary, errorMessageAccessible };
  return summary;
}

try {
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext(), browser.newContext()]);
  const [citizen, volunteer, coordinator, admin] = await Promise.all([
    login(contexts[0], 'citizen.demo@raneev.test', 'Raneev!Citizen26'),
    login(contexts[1], 'volunteer.demo@raneev.test', 'Raneev!Volunteer26'),
    login(contexts[2], 'coordinator.demo@raneev.test', 'Raneev!Coord26'),
    login(contexts[3], 'admin.demo@raneev.test', 'Raneev!Admin26'),
  ]);
  try {
    const results = [
      await assess(citizen, '/citizen'), await assess(citizen, '/citizen/report'), await assess(volunteer, '/volunteer'),
      await assess(coordinator, '/coordinator'), await assess(coordinator, '/demo'), await assess(admin, '/admin'),
    ];
    const smallTargets = results.flatMap((item, index) => item.small.map(control => ({ path: ['/citizen', '/citizen/report', '/volunteer', '/coordinator', '/demo', '/admin'][index], ...control })));
    const visibleNonColorStatusLabels = results.reduce((sum, item) => sum + item.statusLabels.length, 0);
    if (visibleNonColorStatusLabels === 0) throw new Error('No visible text status label independent of color was found across the audited workspaces.');
    console.log(JSON.stringify({ screens: results.length, keyboardFocus: true, unlabeledControls: 0, visibleNonColorStatusLabels, accessibleErrorMessages: results.filter(item => item.errorMessageAccessible).length, minimumTouchTargetExceptions: smallTargets.length, smallTargets }));
  } finally { await Promise.all(contexts.map(context => context.close())); }
} finally { await browser.close(); }
