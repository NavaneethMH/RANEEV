import { describe, expect, it } from "vitest";
import { averageAcceptanceMinutes, coordinatorPriority } from "./coordinator/metrics";

describe("coordinator command-center metrics", () => {
  it("averages only valid persisted activation-to-acceptance durations", () => {
    const started = new Date("2026-08-23T10:00:00.000Z");
    expect(averageAcceptanceMinutes([
      { createdAt: started, acceptedAt: new Date("2026-08-23T10:02:00.000Z") },
      { createdAt: started, acceptedAt: new Date("2026-08-23T10:04:00.000Z") },
      { createdAt: started, acceptedAt: null },
    ])).toBe(3);
  });

  it("returns no average when accepted timestamps are unavailable or invalid", () => {
    const started = new Date("2026-08-23T10:00:00.000Z");
    expect(averageAcceptanceMinutes([{ createdAt: started, acceptedAt: null }])).toBeNull();
    expect(averageAcceptanceMinutes([{ createdAt: started, acceptedAt: new Date("2026-08-23T09:59:00.000Z") }])).toBeNull();
  });

  it("places critical searching records above lower-priority operational states", () => {
    expect(coordinatorPriority("searching", "critical")).toBeGreaterThan(coordinatorPriority("en_route", "standard"));
  });
});
