import { describe, expect, it } from "vitest";
import type { Incident } from "../drizzle/schema";
import { canCloseGoldenHourResponse, ghrEscalationLabels, ghrSeverityLabels, isGoldenHourActive } from "./ghr/policy";

const incident = (status: Incident["status"]) => ({ status } as Incident);

describe("Golden Hour Response policy", () => {
  it("keeps GHR active until the shared incident reaches a terminal state", () => {
    expect(isGoldenHourActive(incident("searching"))).toBe(true);
    expect(isGoldenHourActive(incident("assisting"))).toBe(true);
    expect(isGoldenHourActive(incident("resolved"))).toBe(false);
  });

  it("permits coordinator closure only after arrival or assistance on the shared lifecycle", () => {
    expect(canCloseGoldenHourResponse(incident("en_route"))).toBe(false);
    expect(canCloseGoldenHourResponse(incident("arrived"))).toBe(true);
    expect(canCloseGoldenHourResponse(incident("assisting"))).toBe(true);
  });

  it("defines every persisted operational severity and escalation state for display", () => {
    expect(ghrSeverityLabels.critical).toBe("Critical priority");
    expect(ghrEscalationLabels.professional_services_contacted).toBe("Professional services contacted");
  });
});
