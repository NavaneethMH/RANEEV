# Coordinator Command-Center Verification

The coordinator command center uses a protected `coordinator.commandCenter` procedure over the existing `incidents`, `users`, and immutable `incidentEvents` records. It does not use presentation-only counters or a parallel incident feed.

The main screen presents the operational structure requested: three top metrics for active emergencies, verified available responders, and persisted activation-to-acceptance average time; a managed live map of active incidents and permitted responder positions; a prioritized active-incidents queue; responder field state; and a shared incident timeline. The map was verified after provider stabilization with active markers, a responder route, recentering, and actual Google map tiles.

Live checks returned `403` for a Citizen invoking the command-center procedure and returned coordinator metrics of one active emergency, one available responder, and a 1.1 minute average acceptance time. Creating a new Citizen incident changed the same coordinator summary’s active-emergency metric to two, proving the command-center source is the persisted shared incident store. Authenticated desktop and 375 px mobile browser runs both passed; the mobile run confirmed no horizontal overflow.
