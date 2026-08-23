export type MapCoordinate = { lat: number; lng: number };

export type EmergencyRouteKeyInput = {
  incidentId: string;
  incidentPosition: MapCoordinate;
  responderId: string | null;
  responderPosition: MapCoordinate | null;
  explicitRoute: { origin: MapCoordinate; destination: MapCoordinate } | null;
};

/** Keeps a displayed incident route stable while the responder marker receives live position updates. */
export function buildEmergencyRouteKey(input: EmergencyRouteKeyInput) {
  if (input.explicitRoute) {
    const { origin, destination } = input.explicitRoute;
    return `fixed:${input.incidentId}:${origin.lat.toFixed(5)}:${origin.lng.toFixed(5)}:${destination.lat.toFixed(5)}:${destination.lng.toFixed(5)}`;
  }
  if (!input.responderPosition || !input.responderId) return null;
  return `assignment:${input.incidentId}:${input.responderId}:${input.incidentPosition.lat.toFixed(5)}:${input.incidentPosition.lng.toFixed(5)}`;
}
