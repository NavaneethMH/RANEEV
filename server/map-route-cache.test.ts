import { describe, expect, it } from "vitest";
import { buildEmergencyRouteKey } from "../shared/map-route-cache";

describe("emergency route cache key", () => {
  const incidentPosition = { lat: 12.9801, lng: 77.6003 };

  it("reuses the route when only a live responder marker position changes", () => {
    const initial = buildEmergencyRouteKey({ incidentId: "ERN-QA", incidentPosition, responderId: "responder-42", responderPosition: { lat: 12.97268, lng: 77.59209 }, explicitRoute: null });
    const moved = buildEmergencyRouteKey({ incidentId: "ERN-QA", incidentPosition, responderId: "responder-42", responderPosition: { lat: 12.97392, lng: 77.59346 }, explicitRoute: null });
    expect(initial).toBe("assignment:ERN-QA:responder-42:12.98010:77.60030");
    expect(moved).toBe(initial);
  });

  it("recalculates for a different incident, assignment, or explicitly selected route", () => {
    const base = buildEmergencyRouteKey({ incidentId: "ERN-QA", incidentPosition, responderId: "responder-42", responderPosition: { lat: 12.97268, lng: 77.59209 }, explicitRoute: null });
    const differentIncident = buildEmergencyRouteKey({ incidentId: "ERN-NEXT", incidentPosition, responderId: "responder-42", responderPosition: { lat: 12.97268, lng: 77.59209 }, explicitRoute: null });
    const differentResponder = buildEmergencyRouteKey({ incidentId: "ERN-QA", incidentPosition, responderId: "responder-99", responderPosition: { lat: 12.97268, lng: 77.59209 }, explicitRoute: null });
    const explicit = buildEmergencyRouteKey({ incidentId: "ERN-QA", incidentPosition, responderId: "responder-42", responderPosition: { lat: 12.97268, lng: 77.59209 }, explicitRoute: { origin: { lat: 12.98, lng: 77.6 }, destination: { lat: 12.99, lng: 77.61 } } });
    expect(differentIncident).not.toBe(base);
    expect(differentResponder).not.toBe(base);
    expect(explicit).toBe("fixed:ERN-QA:12.98000:77.60000:12.99000:77.61000");
  });
});
