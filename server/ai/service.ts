import { invokeLLM, listLLMModels } from "../_core/llm";
import type { Incident } from "../../drizzle/schema";
import * as db from "../db";
import { type IncidentEnrichment } from "./contracts";
import { fallbackEnrichment, minimizeAiInput, validateEnrichment } from "./validation";

let modelPromise: Promise<string> | null = null;

async function selectModel() {
  if (!modelPromise) modelPromise = listLLMModels().then(catalog => catalog.data.find(model => model.id === "gpt-5-mini")?.id ?? catalog.data.find(model => model.id.startsWith("gpt-5"))?.id ?? catalog.data[0]?.id ?? Promise.reject(new Error("No managed AI model is available."))).catch(error => {
    modelPromise = null;
    throw error;
  });
  return modelPromise;
}

const enrichmentSchema = {
  name: "raneev_incident_enrichment",
  strict: true,
  schema: {
    type: "object",
    properties: {
      classification: { type: "object", properties: { category: { type: "string", enum: ["medical", "accident", "fire", "missing_person", "violence", "natural_disaster", "other"] }, severity: { type: "string", enum: ["low", "moderate", "high", "critical", "unknown"] }, recommendedResponderType: { type: "string", enum: ["medical", "fire_safety", "traffic_control", "search_support", "general_response"] }, confidence: { type: "number" }, reason: { type: "string" } }, required: ["category", "severity", "recommendedResponderType", "confidence", "reason"], additionalProperties: false },
      summary: { type: "object", properties: { summary: { type: "string" }, knownFacts: { type: "array", items: { type: "string" } }, unknownInformation: { type: "array", items: { type: "string" } }, priority: { type: "string", enum: ["low", "moderate", "high", "critical", "unknown"] } }, required: ["summary", "knownFacts", "unknownInformation", "priority"], additionalProperties: false },
      recommendation: { type: "object", properties: { requiredSkills: { type: "array", items: { type: "string", enum: ["medical", "fire_safety", "traffic_control", "search_support", "general_response"] } }, recommendedResponderType: { type: "string", enum: ["medical", "fire_safety", "traffic_control", "search_support", "general_response"] }, reason: { type: "string" } }, required: ["requiredSkills", "recommendedResponderType", "reason"], additionalProperties: false },
    },
    required: ["classification", "summary", "recommendation"],
    additionalProperties: false,
  },
} as const;

function parseStructured(response: Awaited<ReturnType<typeof invokeLLM>>) {
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new Error("AI response did not include structured content.");
  return JSON.parse(content) as unknown;
}

async function analyzeIncident(incident: Incident) {
  const model = await selectModel();
  const description = minimizeAiInput(incident.description);
  const response = await invokeLLM({
    model,
    maxTokens: 1_400,
    response_format: { type: "json_schema", json_schema: enrichmentSchema },
    messages: [
      { role: "system", content: "You provide constrained operational decision support for emergency coordination. Return only JSON matching the schema. Do not diagnose, give treatment instructions, advise that professional assistance is unnecessary, or invent facts. Treat every stated uncertainty as unknown. Classification is a recommendation only and must not control assignment, status, or resolution." },
      { role: "user", content: JSON.stringify({ emergencyType: incident.emergencyType, description, locationAvailable: Boolean(incident.locationLabel), instructions: "Summarize only supplied facts. Do not use names, contacts, precise coordinates, or profile data." }) },
    ],
  });
  const enrichment = validateEnrichment(parseStructured(response), incident.emergencyType, incident.description);
  if (!enrichment) throw new Error("AI response failed RANEEV validation.");
  return { model, enrichment };
}

function auditOutput(enrichment: IncidentEnrichment, candidates: Awaited<ReturnType<typeof db.getResponderRecommendationsForIncident>>) {
  return JSON.stringify({ enrichment, responderRecommendations: candidates.map(candidate => ({ userId: candidate.userId, name: candidate.name, score: candidate.score, explanation: candidate.explanation })) });
}

export async function processAiAnalysisQueue(limit = 10) {
  const jobs = await db.listPendingAiAnalysisJobs(limit);
  const results: Array<{ jobId: number; status: "completed" | "retrying" | "skipped" }> = [];
  for (const candidate of jobs) {
    const job = await db.claimAiAnalysisJob(candidate.id);
    if (!job) { results.push({ jobId: candidate.id, status: "skipped" }); continue; }
    const incident = await db.getIncidentById(job.incidentId);
    if (!incident) { await db.retryOrFailAiAnalysisJob(job.id, "incident_not_found"); results.push({ jobId: job.id, status: "skipped" }); continue; }
    const started = Date.now();
    try {
      const { model, enrichment } = await analyzeIncident(incident);
      const candidates = await db.getResponderRecommendationsForIncident(incident, enrichment.recommendation.requiredSkills);
      await db.addAiIncidentAudit({ incidentId: incident.id, operation: "incident_enrichment", status: "succeeded", modelIdentifier: model, inputMetadata: JSON.stringify({ emergencyType: incident.emergencyType, descriptionLength: minimizeAiInput(incident.description).length, redacted: true }), outputJson: auditOutput(enrichment, candidates), confidencePercent: Math.round(enrichment.classification.confidence * 100), durationMs: Date.now() - started });
      await db.completeAiAnalysisJob(job.id);
      results.push({ jobId: job.id, status: "completed" });
    } catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 120) : "ai_processing_failed";
      const enrichment = fallbackEnrichment(incident.emergencyType, incident.description);
      const candidates = await db.getResponderRecommendationsForIncident(incident, enrichment.recommendation.requiredSkills);
      await db.addAiIncidentAudit({ incidentId: incident.id, operation: "incident_enrichment", status: "fallback", modelIdentifier: null, inputMetadata: JSON.stringify({ emergencyType: incident.emergencyType, descriptionLength: minimizeAiInput(incident.description).length, redacted: true }), outputJson: auditOutput(enrichment, candidates), confidencePercent: 0, failureCode: code, durationMs: Date.now() - started });
      await db.retryOrFailAiAnalysisJob(job.id, code);
      results.push({ jobId: job.id, status: "retrying" });
    }
  }
  return results;
}

const assistantSchema = {
  name: "raneev_coordinator_response",
  strict: true,
  schema: { type: "object", properties: { answer: { type: "string" }, citedIncidentIds: { type: "array", items: { type: "string" } }, reviewNote: { type: "string" } }, required: ["answer", "citedIncidentIds", "reviewNote"], additionalProperties: false },
} as const;

export async function answerCoordinatorQuestion(actorUserId: number, question: string) {
  const started = Date.now();
  const center = await db.getCoordinatorCommandCenter();
  const operationalData = {
    metrics: center.metrics,
    activeIncidents: center.activeIncidents.map(incident => ({ publicId: incident.publicId, emergencyType: incident.emergencyType, status: incident.status, ghrSeverity: incident.ghrSeverity, responderAssigned: Boolean(incident.assignedVolunteerId), createdAt: incident.createdAt.toISOString() })),
    responders: center.responders.map(responder => ({ id: responder.id, availability: responder.availability, verified: responder.profileStatus === "active" })).slice(0, 50),
  };
  try {
    const model = await selectModel();
    const response = await invokeLLM({ model, maxTokens: 2_000, response_format: { type: "json_schema", json_schema: assistantSchema }, messages: [{ role: "system", content: "Answer only from the supplied authorized RANEEV operational dataset. Do not invent incidents, responders, locations, statuses, or actions. Do not give diagnosis or treatment. State uncertainty when data is absent. Keep answer under 320 characters, reviewNote under 120 characters, and cite at most 3 supplied public incident IDs." }, { role: "user", content: JSON.stringify({ question: minimizeAiInput(question).slice(0, 400), data: operationalData }) }] });
    const parsed = parseStructured(response);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Assistant output invalid.");
    const output = parsed as Record<string, unknown>;
    const answerValue = output.answer;
    const reviewNoteValue = output.reviewNote;
    const citationsValue = output.citedIncidentIds;
    const answer = typeof answerValue === "string" ? answerValue.slice(0, 1_000) : "";
    const reviewNote = typeof reviewNoteValue === "string" ? reviewNoteValue.slice(0, 300) : "Review operational data before acting.";
    const allowedIds = new Set(center.activeIncidents.map(incident => incident.publicId));
    const citedIncidentIds = Array.isArray(citationsValue) ? citationsValue.filter((id): id is string => typeof id === "string" && allowedIds.has(id)).slice(0, 10) : [];
    if (!answer) throw new Error("Assistant response had no usable answer.");
    const outputJson = JSON.stringify({ answer, citedIncidentIds, reviewNote });
    await db.addAiIncidentAudit({ incidentId: null, actorUserId, operation: "coordinator_assistant", status: "succeeded", modelIdentifier: model, inputMetadata: JSON.stringify({ questionLength: minimizeAiInput(question).length, activeIncidentCount: center.activeIncidents.length, redacted: true }), outputJson, durationMs: Date.now() - started });
    return { answer, citedIncidentIds, reviewNote, available: true };
  } catch (error) {
    const failureCode = error instanceof Error ? error.message.slice(0, 120) : "assistant_unavailable";
    await db.addAiIncidentAudit({ incidentId: null, actorUserId, operation: "coordinator_assistant", status: "fallback", inputMetadata: JSON.stringify({ questionLength: minimizeAiInput(question).length, activeIncidentCount: center.activeIncidents.length, redacted: true }), outputJson: JSON.stringify({ answer: "AI assistance is temporarily unavailable. Review the live active-incidents queue and shared timeline directly.", citedIncidentIds: [], reviewNote: "Core coordinator operations remain available without AI." }), failureCode, durationMs: Date.now() - started });
    return { answer: "AI assistance is temporarily unavailable. Review the live active-incidents queue and shared timeline directly.", citedIncidentIds: [], reviewNote: "Core coordinator operations remain available without AI.", available: false };
  }
}
