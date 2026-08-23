# Golden Hour Response Verification

Golden Hour Response is an incident-centred coordinator workflow over the same persisted Citizen-created `incidents` and immutable `incidentEvents` records used by ERN and Volunteer Mode. It does not create a second GHR incident model or a standalone dashboard.

The coordinator workflow was validated on Citizen request `ERN-D97E684D6F38`. The interface displayed a live **TIME SINCE INCIDENT** timer, operational severity, the assigned responder's availability, managed-provider nearby hospital choices, an incident-to-selected-facility route, a server-persisted 7.6 km / 16 minute route estimate, escalation state, and the shared timeline. The map-derived facility route is explicitly operational only; it does not provide clinical suitability or diagnosis.

Authorization and lifecycle checks confirmed that a Citizen received `403` for a Golden Hour severity mutation, an unassigned Volunteer received `403` for the incident overview, and coordinator resolution received `409` before responder arrival. On `ERN-86A000AEC50A`, the assigned Volunteer moved through `en_route`, `arrived`, and `assisting`; coordinator Golden Hour resolution then returned `200` and reset the responder to `offline`. The Citizen’s timeline contained severity, facility-selection, escalation, and coordinator-resolution events on that same record.

Authenticated browser verification completed the coordinator desktop Golden Hour sequence and captured `ghr-operational-sequence.png`. The 375 px mobile Golden Hour route was also verified, including the persistent time indicator and no horizontal overflow after constraining the map column.
