# Emergency Mapping Provider Contract

RANEEV currently uses the managed **Google Maps frontend integration** through `MapView` and `googleEmergencyMapAdapter.ts`. No browser-side API key is stored or requested. The selected provider is isolated behind the following provider-neutral types in `client/src/lib/maps/contracts.ts`:

- `MapCoordinate` for latitude/longitude values;
- `EmergencyMapMarker` for current, incident, responder, and hospital markers;
- `EmergencyMapData` for the active incident map state; and
- `EmergencyMapController` for `update`, `recenter`, and `destroy` operations.

To introduce another provider, implement a new adapter that consumes `EmergencyMapData` and returns the same controller contract. The Citizen workflow and server APIs should not be changed. Google-specific directions and Places calls are confined to the current adapter.

## Data and authorization boundaries

Current device location is requested in the browser only after an explicit citizen action. It is used locally to improve the confirmation preview and is sent to the server only when the citizen confirms an emergency request. Incident and responder coordinates are persisted as integer microdegrees. The protected `incidents.mapSnapshot` procedure uses the same ownership/assignment/operations authorization policy as incident details. The `volunteer.updateLocation` procedure accepts updates only from the responder assigned to the incident. Development responder movement is disabled in production and remains scoped to the requesting citizen’s own incident.

## Provider responsibilities

| Capability | Current implementation | Future provider requirement |
|---|---|---|
| Map rendering and recentering | Google Maps `MapView` + adapter controller | Render coordinates and fit/recenter bounds |
| Incident and responder markers | Provider markers from protected snapshot | Render typed markers without exposing extra profile data |
| Route, distance, ETA | Google Directions Service | Return driving route geometry and normalized metric values |
| Nearby hospitals | Google Places nearby search | Return map-only care-facility markers near the incident |
| Live movement | Protected snapshot polling + authorized position updates | Apply changed responder coordinates without changing the shared map contract |
