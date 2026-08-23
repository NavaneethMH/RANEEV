import { describe, expect, it } from "vitest";
import { scoreResponders } from "./ai/matching";
import { fallbackEnrichment, minimizeAiInput, validateEnrichment } from "./ai/validation";

describe("RANEEV AI safety and deterministic matching", () => {
  it("redacts unnecessary contact data before optional AI processing", () => {
    expect(minimizeAiInput("Call 9876543210 or sam@example.test after a collapse")).not.toContain("9876543210");
    expect(minimizeAiInput("Call 9876543210 or sam@example.test after a collapse")).not.toContain("sam@example.test");
  });

  it("prevents a danger-indicator classification from being downgraded", () => {
    const validated = validateEnrichment({ classification: { category: "medical", severity: "low", recommendedResponderType: "medical", confidence: 0.8, reason: "Reported issue." }, summary: { summary: "Person collapsed.", knownFacts: ["Collapsed"], unknownInformation: ["Breathing status"], priority: "low" }, recommendation: { requiredSkills: ["medical"], recommendedResponderType: "medical", reason: "Medical responder." } }, "medical", "Person has collapsed and is not responding.");
    expect(validated?.classification.severity).toBe("high");
    expect(validated?.summary.priority).toBe("high");
  });

  it("returns a safe deterministic fallback when AI is unavailable", () => {
    expect(fallbackEnrichment("road_accident", "A person is unconscious").classification.category).toBe("accident");
    expect(fallbackEnrichment("road_accident", "A person is unconscious").classification.severity).toBe("high");
  });

  it("keeps verified availability, distance, and skills deterministic when ranking responders", () => {
    const [best] = scoreResponders([{ userId: 1, name: "Near verified", distanceMeters: 1_000, availability: "available", verified: true, skills: ["medical"] }, { userId: 2, name: "Near but unverified", distanceMeters: 500, availability: "available", verified: false, skills: ["medical"] }], ["medical"]);
    expect(best.userId).toBe(1);
  });
});
