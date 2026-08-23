import { describe, expect, it } from "vitest";
import type { Incident } from "../drizzle/schema";
import { buildPrivacyMinimizedSms } from "./notifications/service";

const incident = { publicId: "ERN-TESTNOTICE", emergencyType: "medical", locationLabel: "Private address", description: "Personal details must not appear in SMS" } as Incident;

describe("notification message safety", () => {
  it("keeps optional SMS generic and excludes location, description, and medical details", () => {
    const body = buildPrivacyMinimizedSms(incident, "critical");
    expect(body).toContain("ERN-TESTNOTICE");
    expect(body).not.toContain("Private address");
    expect(body).not.toContain("Personal details");
    expect(body).not.toContain("medical");
  });
});
