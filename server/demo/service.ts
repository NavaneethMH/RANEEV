import { randomUUID } from "node:crypto";
import type { DemoRunStatus, DemoStage, Incident, User } from "../../drizzle/schema";
import * as db from "../db";
import { notifyDemoLifecycle } from "../notifications/service";
import { demoStageOffsets, demoStageOrder, getDemoTiming, nextDemoStage, stageForDemoElapsed, type DemoTiming } from "./config";
import { isDemoActor as isActor, isDemoPresenter as isPresenter } from "./policy";

const DEMO_CITIZEN_EMAIL = "citizen.demo@raneev.test";
const DEMO_VOLUNTEER_EMAIL = "volunteer.demo@raneev.test";
const DEMO_COORDINATOR_EMAIL = "coordinator.demo@raneev.test";
const DEMO_ADMIN_EMAIL = "admin.demo@raneev.test";
const DEMO_LOCATION = { label: "Demo Training Corridor · Main Road", latitudeE6: 12_980_100, longitudeE6: 77_600_300 };
const DEMO_RESPONDER_START = { latitudeE6: 12_969_800, longitudeE6: 77_588_900 };
const DEMO_DESCRIPTION = "Road accident reported near the main road. One person appears unconscious and immediate assistance is required. This is controlled demo data only.";

export type DemoActors = { citizen: User; volunteer: User; coordinator: User; admin: User };
export type DemoModeStatus = {
  status: DemoRunStatus;
  stage: DemoStage;
  nextStage: DemoStage | null;
  elapsedSeconds: number;
  incident: Incident | null;
  actorNames: { citizen: string; volunteer: string; coordinator: string };
  responderPlan: { latitude: number; longitude: number; distanceKm: number; etaMinutes: number };
  metrics: { responderDetectionSeconds: number; acceptanceSeconds: number; travelSeconds: number; totalResponseSeconds: number; resolutionSeconds: number };
  timing: DemoTiming;
};

export function isDemoActor(user: User) {
  return isActor(user);
}

export function isDemoPresenter(user: User) {
  return isPresenter(user);
}

function emitDemoNotice(incident: Incident, stage: DemoStage, actors: DemoActors) {
  void notifyDemoLifecycle(incident, stage, actors).catch(error => console.warn("[Demo Mode] Non-blocking demo notification failed:", error instanceof Error ? error.message : error));
}

async function requireDemoActors(): Promise<DemoActors> {
  const [citizen, volunteer, coordinator, admin] = await Promise.all([db.getUserByEmail(DEMO_CITIZEN_EMAIL), db.getUserByEmail(DEMO_VOLUNTEER_EMAIL), db.getUserByEmail(DEMO_COORDINATOR_EMAIL), db.getUserByEmail(DEMO_ADMIN_EMAIL)]);
  if (!citizen || !volunteer || !coordinator || !admin) throw new Error("Controlled Demo Mode accounts are unavailable.");
  if (citizen.role !== "citizen" || volunteer.role !== "volunteer" || coordinator.role !== "coordinator" || admin.role !== "admin") throw new Error("Controlled Demo Mode account roles are invalid.");
  return { citizen, volunteer, coordinator, admin };
}

function stageIndex(stage: DemoStage) {
  return demoStageOrder.indexOf(stage);
}

function elapsedForRun(run: { startedAt: Date | null; pausedAt: Date | null; accumulatedPausedMs: number }, now = Date.now()) {
  if (!run.startedAt) return 0;
  const paused = run.pausedAt ? now - run.pausedAt.getTime() : 0;
  return Math.max(0, Math.floor((now - run.startedAt.getTime() - run.accumulatedPausedMs - paused) / 1_000));
}

function responderPosition(elapsedSeconds: number, timing: DemoTiming) {
  const offsets = demoStageOffsets(timing);
  const travelSeconds = Math.max(1, timing.movementDurationSeconds);
  const progress = Math.min(1, Math.max(0, (elapsedSeconds - offsets.responder_moving) / travelSeconds));
  const latitudeE6 = Math.round(DEMO_RESPONDER_START.latitudeE6 + (DEMO_LOCATION.latitudeE6 - DEMO_RESPONDER_START.latitudeE6) * progress);
  const longitudeE6 = Math.round(DEMO_RESPONDER_START.longitudeE6 + (DEMO_LOCATION.longitudeE6 - DEMO_RESPONDER_START.longitudeE6) * progress);
  return { latitudeE6, longitudeE6, progress, etaMinutes: Math.max(0, Math.ceil((1 - progress) * travelSeconds / 60)) };
}

function metricsFor(timing: DemoTiming) {
  const offsets = demoStageOffsets(timing);
  return { responderDetectionSeconds: offsets.responder_detected, acceptanceSeconds: timing.acceptanceSeconds, travelSeconds: timing.movementDurationSeconds, totalResponseSeconds: offsets.responder_arrived, resolutionSeconds: offsets.incident_resolved };
}

function emptyStatus(actors: DemoActors | null, timing = getDemoTiming()): DemoModeStatus {
  return { status: "idle", stage: "new_emergency", nextStage: "responder_detected", elapsedSeconds: 0, incident: null, actorNames: { citizen: actors?.citizen.name ?? "Demo Citizen", volunteer: actors?.volunteer.name ?? "Arjun Kumar — Demo Responder", coordinator: actors?.coordinator.name ?? "Demo Coordinator" }, responderPlan: { latitude: DEMO_RESPONDER_START.latitudeE6 / 1_000_000, longitude: DEMO_RESPONDER_START.longitudeE6 / 1_000_000, distanceKm: 1.6, etaMinutes: Math.max(1, Math.ceil(timing.movementDurationSeconds / 60)) }, metrics: metricsFor(timing), timing };
}

async function transitionDemoStage(incident: Incident, stage: DemoStage, actors: DemoActors) {
  if (stage === "responder_detected") {
    await db.addDemoIncidentEvent(incident.id, actors.coordinator.id, "search_started", "Nearby responder detected: Arjun Kumar — Demo Responder (1.6 km, First Aid)." );
    emitDemoNotice(incident, stage, actors);
    return incident;
  }
  if (stage === "responder_accepted") {
    await db.setVolunteerAvailability(actors.volunteer.id, { availability: "busy", latitudeE6: DEMO_RESPONDER_START.latitudeE6, longitudeE6: DEMO_RESPONDER_START.longitudeE6 });
    const accepted = await db.acceptIncident(incident.publicId, actors.volunteer.id);
    if (!accepted) throw new Error("Demo responder assignment did not complete.");
    await db.addDemoIncidentEvent(accepted.id, actors.volunteer.id, "responder_accepted", "Arjun Kumar — Demo Responder accepted the controlled emergency." );
    emitDemoNotice(accepted, stage, actors);
    return accepted;
  }
  if (stage === "responder_moving") {
    const moving = await db.volunteerAdvance(incident.publicId, actors.volunteer.id, "en_route");
    if (!moving) throw new Error("Demo responder route did not start.");
    await db.addDemoIncidentEvent(moving.id, actors.volunteer.id, "en_route", "Responder movement started along the predefined demo route." );
    emitDemoNotice(moving, stage, actors);
    return moving;
  }
  if (stage === "responder_arrived") {
    const arrived = await db.volunteerAdvance(incident.publicId, actors.volunteer.id, "arrived");
    if (!arrived) throw new Error("Demo responder arrival did not complete.");
    await db.updateDemoResponderPosition(arrived.publicId, actors.volunteer.id, DEMO_LOCATION.latitudeE6, DEMO_LOCATION.longitudeE6, 0);
    await db.addDemoIncidentEvent(arrived.id, actors.volunteer.id, "arrived", "Responder arrived at the predefined controlled incident location." );
    emitDemoNotice(arrived, stage, actors);
    return (await db.getIncidentByPublicId(arrived.publicId)) ?? arrived;
  }
  if (stage === "incident_resolved") {
    const resolved = await db.resolveIncidentByVolunteer(incident.publicId, actors.volunteer.id);
    if (!resolved) throw new Error("Demo incident resolution did not complete.");
    await db.setVolunteerAvailability(actors.volunteer.id, { availability: "offline" });
    await db.addDemoIncidentEvent(resolved.id, actors.volunteer.id, "resolved", "Controlled emergency response completed; Demo Metrics are available." );
    emitDemoNotice(resolved, stage, actors);
    return resolved;
  }
  return incident;
}

async function syncRun(now = Date.now()) {
  const [run, actors] = await Promise.all([db.getDemoRun(), requireDemoActors()]);
  if (!run?.incidentId) return { run, actors, incident: null, elapsedSeconds: 0 };
  let incident = await db.getIncidentById(run.incidentId);
  if (!incident?.isDemo) return { run, actors, incident: null, elapsedSeconds: 0 };
  const timing = getDemoTiming();
  const elapsedSeconds = elapsedForRun(run, now);
  if (run.status === "running") {
    const targetStage = stageForDemoElapsed(elapsedSeconds, timing);
    let currentStage = run.stage;
    while (stageIndex(currentStage) < stageIndex(targetStage)) {
      const upcoming = nextDemoStage(currentStage);
      if (!upcoming) break;
      incident = await transitionDemoStage(incident, upcoming, actors);
      currentStage = upcoming;
      const completedAt = currentStage === "incident_resolved" ? new Date(now) : null;
      await db.saveDemoRun({ status: currentStage === "incident_resolved" ? "completed" : "running", stage: currentStage, incidentId: incident.id, startedAt: run.startedAt, pausedAt: null, accumulatedPausedMs: run.accumulatedPausedMs, completedAt });
    }
    if (stageIndex(currentStage) >= stageIndex("responder_accepted") && stageIndex(currentStage) < stageIndex("responder_arrived") && incident.assignedVolunteerId) {
      const position = responderPosition(elapsedSeconds, timing);
      incident = (await db.updateDemoResponderPosition(incident.publicId, actors.volunteer.id, position.latitudeE6, position.longitudeE6, position.etaMinutes)) ?? incident;
    }
  }
  const refreshedRun = await db.getDemoRun();
  const refreshedIncident = refreshedRun?.incidentId ? await db.getIncidentById(refreshedRun.incidentId) : incident;
  return { run: refreshedRun, actors, incident: refreshedIncident, elapsedSeconds: refreshedRun ? elapsedForRun(refreshedRun, now) : 0 };
}

export async function getDemoModeStatus() {
  const timing = getDemoTiming();
  const synced = await syncRun();
  if (!synced.run || !synced.incident) return emptyStatus(synced.actors, timing);
  const position = responderPosition(synced.elapsedSeconds, timing);
  return { status: synced.run.status, stage: synced.run.stage, nextStage: nextDemoStage(synced.run.stage), elapsedSeconds: synced.elapsedSeconds, incident: synced.incident, actorNames: { citizen: synced.actors.citizen.name, volunteer: synced.actors.volunteer.name, coordinator: synced.actors.coordinator.name }, responderPlan: { latitude: position.latitudeE6 / 1_000_000, longitude: position.longitudeE6 / 1_000_000, distanceKm: 1.6, etaMinutes: position.etaMinutes }, metrics: metricsFor(timing), timing } satisfies DemoModeStatus;
}

export async function startDemoMode() {
  const actors = await requireDemoActors();
  const existing = await db.getDemoRun();
  if (existing?.status === "running" || existing?.status === "paused") throw new Error("A Demo Mode run is already active. Pause, reset, or complete it before starting again.");
  if (existing?.incidentId) await db.deleteDemoIncidentArtifacts(existing.incidentId);
  await db.setVolunteerAvailability(actors.volunteer.id, { availability: "available", latitudeE6: DEMO_RESPONDER_START.latitudeE6, longitudeE6: DEMO_RESPONDER_START.longitudeE6 });
  const incident = await db.createDemoIncident({ publicId: `RNV-DEMO-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`, createdByUserId: actors.citizen.id, locationLabel: DEMO_LOCATION.label, latitudeE6: DEMO_LOCATION.latitudeE6, longitudeE6: DEMO_LOCATION.longitudeE6, description: DEMO_DESCRIPTION });
  await db.saveDemoRun({ status: "running", stage: "new_emergency", incidentId: incident.id, startedAt: new Date(), pausedAt: null, accumulatedPausedMs: 0, completedAt: null });
  emitDemoNotice(incident, "new_emergency", actors);
  return getDemoModeStatus();
}

export async function pauseDemoMode() {
  const synced = await syncRun();
  if (!synced.run?.incidentId || synced.run.status !== "running") throw new Error("Demo Mode is not running.");
  await db.saveDemoRun({ status: "paused", stage: synced.run.stage, incidentId: synced.run.incidentId, startedAt: synced.run.startedAt, pausedAt: new Date(), accumulatedPausedMs: synced.run.accumulatedPausedMs, completedAt: null });
  return getDemoModeStatus();
}

export async function resumeDemoMode() {
  const run = await db.getDemoRun();
  if (!run?.incidentId || run.status !== "paused" || !run.pausedAt) throw new Error("Demo Mode is not paused.");
  const now = new Date();
  await db.saveDemoRun({ status: "running", stage: run.stage, incidentId: run.incidentId, startedAt: run.startedAt, pausedAt: null, accumulatedPausedMs: run.accumulatedPausedMs + (now.getTime() - run.pausedAt.getTime()), completedAt: null });
  return getDemoModeStatus();
}

export async function skipDemoModeStage() {
  const synced = await syncRun();
  if (!synced.run?.incidentId || !synced.incident || !["running", "paused"].includes(synced.run.status)) throw new Error("Demo Mode is not active.");
  const upcoming = nextDemoStage(synced.run.stage);
  if (!upcoming) return getDemoModeStatus();
  const incident = await transitionDemoStage(synced.incident, upcoming, synced.actors);
  const completedAt = upcoming === "incident_resolved" ? new Date() : null;
  const targetElapsedSeconds = demoStageOffsets(getDemoTiming())[upcoming];
  const additionalElapsedMs = Math.max(0, targetElapsedSeconds - elapsedForRun(synced.run)) * 1_000;
  const startedAt = synced.run.startedAt ? new Date(synced.run.startedAt.getTime() - additionalElapsedMs) : synced.run.startedAt;
  await db.saveDemoRun({ status: upcoming === "incident_resolved" ? "completed" : synced.run.status, stage: upcoming, incidentId: incident.id, startedAt, pausedAt: synced.run.pausedAt, accumulatedPausedMs: synced.run.accumulatedPausedMs, completedAt });
  return getDemoModeStatus();
}

export async function resetDemoMode() {
  const [run, actors] = await Promise.all([db.getDemoRun(), requireDemoActors()]);
  if (run?.incidentId) await db.deleteDemoIncidentArtifacts(run.incidentId);
  await db.setVolunteerAvailability(actors.volunteer.id, { availability: "offline" });
  await db.saveDemoRun({ status: "idle", stage: "new_emergency", incidentId: null, startedAt: null, pausedAt: null, accumulatedPausedMs: 0, completedAt: null });
  return getDemoModeStatus();
}
