/* RANEEV lifecycle tests — accepted citizen requests can only advance through the verified golden-path sequence. */
import { describe, expect, it } from "vitest";
import { canTransition, lifecycleEventFor } from "./incidents/lifecycle";

describe("Citizen Emergency Request lifecycle", () => {
  it("permits only the golden-path status sequence", () => {
    expect(canTransition("searching", "accepted")).toBe(true);
    expect(canTransition("accepted", "en_route")).toBe(true);
    expect(canTransition("en_route", "arrived")).toBe(true);
    expect(canTransition("arrived", "assisting")).toBe(true);
    expect(canTransition("assisting", "resolved")).toBe(true);
    expect(canTransition("arrived", "resolved")).toBe(true);
    expect(canTransition("searching", "arrived")).toBe(false);
    expect(canTransition("resolved", "accepted")).toBe(false);
  });

  it("records an explainable event for every verified transition", () => {
    expect(lifecycleEventFor("accepted")).toBe("responder_accepted");
    expect(lifecycleEventFor("en_route")).toBe("en_route");
    expect(lifecycleEventFor("arrived")).toBe("arrived");
    expect(lifecycleEventFor("assisting")).toBe("assistance_started");
    expect(lifecycleEventFor("resolved")).toBe("resolved");
  });
});
