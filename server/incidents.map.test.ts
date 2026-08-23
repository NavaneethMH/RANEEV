import { describe, expect, it } from "vitest";

describe("emergency map coordinate policy", () => {
  it("uses integer microdegrees for stable stored coordinates", () => {
    expect(Math.round(13.1986123 * 1_000_000)).toBe(13_198_612);
    expect(Math.round(77.7102456 * 1_000_000)).toBe(77_710_246);
  });

  it("moves a simulated responder closer to the incident without overshooting it", () => {
    const incident = 13_198_600;
    const responder = 13_216_600;
    const moved = Math.round(responder + (incident - responder) * 0.42);
    expect(Math.abs(moved - incident)).toBeLessThan(Math.abs(responder - incident));
    expect(moved).toBeGreaterThan(incident);
  });
});
