# RANEEV Deterministic Demo Mode — Verification Record

## Scope

Demo Mode is a controlled presenter capability layered on the existing RANEEV shared-record architecture. It preserves the Citizen, Volunteer, Golden Hour Response, Coordinator, notification, AI, and map surfaces while creating only clearly labelled, isolated demo records. The default scenario is a fictional critical road accident involving two affected people at the **Demo Training Corridor · Main Road**. The designated actors are **Demo Citizen**, **Arjun Kumar — Demo Responder**, and **Demo Coordinator**.

## Deterministic Lifecycle

| Stage | Default elapsed time | Shared-record outcome | Demo audience update |
|---|---:|---|---|
| New emergency | 0 sec | Demo incident and GHR state created | Citizen confirmation and coordinator alert |
| Responder detected | 5 sec | Demo responder discovery event | Nearby-responder update |
| Responder accepted | 10 sec | Assigned responder and acceptance event | Assignment notice |
| Responder moving | 15 sec | En-route state and interpolated responder position | Route and ETA update |
| Responder arrived | 40 sec | Arrival state and co-located marker | Arrival notice |
| Incident resolved | 50 sec | Resolution state and final summary | Resolution notice and Demo Metrics |

The timing values are read from `DEMO_RESPONDER_DETECTION_DELAY`, `DEMO_ACCEPTANCE_DELAY`, `DEMO_MOVEMENT_DURATION`, `DEMO_ARRIVAL_DELAY`, and `DEMO_RESOLUTION_DELAY`, with the table above as the default configuration. Presenter controls permit **Start**, **Pause**, **Resume**, **Next Stage**, **Reset**, and **Exit**. A presenter skip aligns the elapsed clock with the selected stage, so a manually advanced moving stage immediately produces deterministic map progression.

## Isolation and Safety

Every simulation incident carries `isDemo = true`; a `demoRuns` row persists the stage, timing, pause state, and incident reference. Reset removes only the demo incident’s related events, AI audit, and notifications, then restores the responder to offline state. Demo records are excluded from normal operational queues and escalation scanning. They are available only to designated demo accounts while an active controlled run exists, and Demo Mode sends only existing **in-app `delivered_demo`** notices; it never calls SMS delivery.

The AI surface uses a deterministic fallback stating **Road Accident · Critical · First Aid / Medical responder recommended**. The map route is requested once for the fixed scenario route while the responder marker updates from interpolated coordinates, avoiding per-frame routing requests. The existing Golden Hour elapsed timer and existing role polling display the shared state without a new persistent background process.

## Automated and Visual Evidence

The final authenticated browser run completed successfully against `RNV-DEMO-36424567`. It confirmed responder detection, pause/resume clock behavior, cross-role citizen/volunteer/coordinator visibility, moving responder coordinates, six demo-only in-app notifications, resolution, and **ten consecutive reset-and-run cycles** with no stale state. The final run reset the simulation, leaving no active demo incident.

| Verification area | Result |
|---|---|
| TypeScript and Vitest regression suite | Passed: 11 files, 27 tests |
| Lifecycle configuration unit coverage | Passed: default offsets and forward-only sequencing |
| Presenter controls | Passed: start, pause, resume, next stage, reset, exit route |
| Multi-role synchronization | Passed: Citizen, Volunteer, and Coordinator read models observed the same demo incident |
| Map movement | Passed: deterministic responder coordinates changed while moving |
| Notifications | Passed: six in-app `delivered_demo` notices; no SMS path used |
| Isolation | Passed: demo rows marked and reset without stale active record |
| Responsive behavior | Passed: desktop and 375px mobile capture; no horizontal overflow |

The desktop presentation workspace retained the current Coordinator shell and visual language, and the completed mobile capture retained the full interactive control panel, timeline, and Demo Metrics in a single-column layout.
