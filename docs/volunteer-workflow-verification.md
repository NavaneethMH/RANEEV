# Volunteer Mode Verification

The authenticated browser workflow logged in as the verified development Volunteer, set real browser test geolocation, viewed a Citizen-created nearby request, accepted the shared record, navigated, arrived, began assistance, and resolved the response. It did not create a second incident system.

The reviewed accepted-state capture shows the authorized response map, incident and responder markers, live responder-position disclosure, mapped route metrics, navigation controls, and the acceptance confirmation. The reviewed assistance-state capture shows the same public incident identifier in the Volunteer workspace, the `ASSISTING` lifecycle status, the protected live route, and the final Volunteer resolution action.

The responsive browser run completed the same shared-record flow at a 375 px viewport. The reviewed mobile accepted-state screen retains readable route metrics, touch-sized navigation and live-position controls, scoped-location disclosure, and the authorized incident map without horizontal overflow.

Cross-role and guard checks used a new Citizen-created record. The primary verified Volunteer accepted it successfully. A second Volunteer received `403` before verification, `403` while verified but offline, `409` when attempting to accept the already assigned incident, and `403` when attempting to begin the assigned responder’s route. The Citizen timeline for the shared record contained acceptance, en-route, arrival, assistance, and resolution events. The legacy `/volunteer/accept` route now redirects to connected nearby review, and `/volunteer/assist` resolves to the protected active-response workspace.
