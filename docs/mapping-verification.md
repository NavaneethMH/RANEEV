# Emergency Mapping Verification

Early HTTPS browser checks exposed two integration defects: unstable object inputs repeatedly reset the protected incident queries, and a conditional live-map memo violated React’s hook order after data arrived. Both issues were corrected before final map verification. The browser workflow now resolves protected incident, timeline, and map-snapshot data in the live Citizen screen.

The final mapped-flow run captures the complete authenticated path, including a responder-position refresh while en route, in `/home/ubuntu/raneev-mapped-citizen-screenshots-final/`.

The reviewed confirmation screen shows the Google Maps provider surface, an incident location preview, the current-location action, and map recentering within the existing emergency flow. The reviewed en-route screen shows the live provider map, recenter control, responder-location disclosure, protected incident details, calculated route distance (8.4 km), calculated ETA (14 min), and the authorized responder-position refresh action. Nearby hospital markers are requested through the provider’s Places search around the incident location; results remain visual map overlays and are not persisted as user data.

If Google Maps cannot load or adapter initialization fails, the emergency map now switches to an explicit degraded state that retains the server-confirmed incident coordinates, responder-status disclosure, and a retry control. Live API checks returned `403` when a different Citizen requested another Citizen’s `incidents.mapSnapshot`, and when a Citizen attempted the responder-only `volunteer.updateLocation` procedure.

The provider request was deliberately blocked in authenticated desktop and mobile browser runs. Both captures show the fallback title, explanatory safety message, confirmed coordinates, retry action, and unchanged emergency-confirmation controls. The mobile fallback retains legible spacing and touch-sized controls without horizontal overflow.
