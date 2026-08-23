import { describe, expect, it } from "vitest";
import { demoStageOffsets, getDemoTiming, nextDemoStage, stageForDemoElapsed } from "./demo/config";

describe("deterministic Demo Mode timing", () => {
  it("uses the configured 50-second lifecycle defaults without hardcoded stage logic", () => {
    const timing = getDemoTiming();
    const offsets = demoStageOffsets(timing);
    expect(offsets).toMatchObject({ new_emergency: 0, responder_detected: 5, responder_accepted: 10, responder_moving: 15, responder_arrived: 40, incident_resolved: 50 });
  });

  it("maps elapsed time and manual sequencing to only valid forward stages", () => {
    expect(stageForDemoElapsed(0)).toBe("new_emergency");
    expect(stageForDemoElapsed(5)).toBe("responder_detected");
    expect(stageForDemoElapsed(10)).toBe("responder_accepted");
    expect(stageForDemoElapsed(15)).toBe("responder_moving");
    expect(stageForDemoElapsed(40)).toBe("responder_arrived");
    expect(stageForDemoElapsed(50)).toBe("incident_resolved");
    expect(nextDemoStage("new_emergency")).toBe("responder_detected");
    expect(nextDemoStage("incident_resolved")).toBeNull();
  });
});
