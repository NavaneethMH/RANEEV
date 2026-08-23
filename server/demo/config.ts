import type { DemoStage } from "../../drizzle/schema";

function positiveSeconds(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 1 && value <= 600 ? Math.round(value) : fallback;
}

export type DemoTiming = {
  responderDetectionSeconds: number;
  acceptanceSeconds: number;
  movementDurationSeconds: number;
  arrivalDelaySeconds: number;
  resolutionSeconds: number;
};

export function getDemoTiming(): DemoTiming {
  return {
    responderDetectionSeconds: positiveSeconds("DEMO_RESPONDER_DETECTION_DELAY", 5),
    acceptanceSeconds: positiveSeconds("DEMO_ACCEPTANCE_DELAY", 5),
    movementDurationSeconds: positiveSeconds("DEMO_MOVEMENT_DURATION", 25),
    arrivalDelaySeconds: positiveSeconds("DEMO_ARRIVAL_DELAY", 5),
    resolutionSeconds: positiveSeconds("DEMO_RESOLUTION_DELAY", 10),
  };
}

export const demoStageOrder: DemoStage[] = ["new_emergency", "responder_detected", "responder_accepted", "responder_moving", "responder_arrived", "incident_resolved"];

export function demoStageOffsets(timing = getDemoTiming()) {
  const responderDetected = timing.responderDetectionSeconds;
  const responderAccepted = responderDetected + timing.acceptanceSeconds;
  const responderMoving = responderAccepted + timing.arrivalDelaySeconds;
  const responderArrived = responderMoving + timing.movementDurationSeconds;
  const incidentResolved = responderArrived + timing.resolutionSeconds;
  return { new_emergency: 0, responder_detected: responderDetected, responder_accepted: responderAccepted, responder_moving: responderMoving, responder_arrived: responderArrived, incident_resolved: incidentResolved } satisfies Record<DemoStage, number>;
}

export function stageForDemoElapsed(elapsedSeconds: number, timing = getDemoTiming()): DemoStage {
  const offsets = demoStageOffsets(timing);
  return [...demoStageOrder].reverse().find(stage => elapsedSeconds >= offsets[stage]) ?? "new_emergency";
}

export function nextDemoStage(stage: DemoStage) {
  const index = demoStageOrder.indexOf(stage);
  return demoStageOrder[index + 1] ?? null;
}
