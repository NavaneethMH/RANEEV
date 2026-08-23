import { aiCategories, aiSeverities, responderTypes, type AiCategory, type AiSeverity, type IncidentEnrichment, type ResponderType } from "./contracts";

const dangerPattern = /\b(unconscious|unresponsive|not responding|collapsed|severe bleeding|bleeding heavily|fire|violent|violence|trapped|cannot breathe|not breathing)\b/i;
const phonePattern = /(?:\+?\d[\s.-]?){7,}\d/g;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isCategory = (value: unknown): value is AiCategory => typeof value === "string" && (aiCategories as readonly string[]).includes(value);
const isSeverity = (value: unknown): value is AiSeverity => typeof value === "string" && (aiSeverities as readonly string[]).includes(value);
const isResponderType = (value: unknown): value is ResponderType => typeof value === "string" && (responderTypes as readonly string[]).includes(value);
const shortText = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const stringList = (value: unknown, maxItems: number, maxLength: number) => Array.isArray(value) ? value.map(item => shortText(item, maxLength)).filter(Boolean).slice(0, maxItems) : [];

export function minimizeAiInput(description: string | null) {
  return (description ?? "").replace(emailPattern, "[redacted email]").replace(phonePattern, "[redacted phone]").replace(/\s+/g, " ").trim().slice(0, 500);
}

export function fallbackEnrichment(emergencyType: string, description: string | null): IncidentEnrichment {
  const category: AiCategory = emergencyType === "road_accident" ? "accident" : emergencyType === "fire" ? "fire" : emergencyType === "medical" || emergencyType === "unconscious" || emergencyType === "injury" ? "medical" : "other";
  const danger = dangerPattern.test(description ?? "");
  const responderType: ResponderType = category === "fire" ? "fire_safety" : category === "accident" ? "traffic_control" : "medical";
  return {
    classification: { category, severity: danger ? "high" : "unknown", recommendedResponderType: responderType, confidence: 0, reason: "AI analysis unavailable; use verified operational assessment." },
    summary: { summary: "AI operational summary unavailable.", knownFacts: [], unknownInformation: ["Operational review required"], priority: danger ? "high" : "unknown" },
    recommendation: { requiredSkills: [responderType], recommendedResponderType: responderType, reason: "Fallback guidance only; deterministic eligibility remains authoritative." },
  };
}

export function validateEnrichment(value: unknown, emergencyType: string, description: string | null): IncidentEnrichment | null {
  if (!isRecord(value) || !isRecord(value.classification) || !isRecord(value.summary) || !isRecord(value.recommendation)) return null;
  const classification = value.classification;
  const summary = value.summary;
  const recommendation = value.recommendation;
  if (!isCategory(classification.category) || !isSeverity(classification.severity) || !isResponderType(classification.recommendedResponderType) || !isSeverity(summary.priority) || !isResponderType(recommendation.recommendedResponderType)) return null;
  const reason = shortText(classification.reason, 240);
  const operationalSummary = shortText(summary.summary, 600);
  const recommendationReason = shortText(recommendation.reason, 240);
  if (!reason || !operationalSummary || !recommendationReason) return null;
  const rawConfidence = typeof classification.confidence === "number" && Number.isFinite(classification.confidence) ? classification.confidence : 0;
  const danger = dangerPattern.test(description ?? "");
  const severity: AiSeverity = danger && ["low", "moderate", "unknown"].includes(classification.severity) ? "high" : classification.severity;
  const priority: AiSeverity = danger && ["low", "moderate", "unknown"].includes(summary.priority) ? "high" : summary.priority;
  const requiredSkills = stringList(recommendation.requiredSkills, 5, 40).filter(isResponderType);
  return {
    classification: { category: classification.category, severity, recommendedResponderType: classification.recommendedResponderType, confidence: Math.max(0, Math.min(1, rawConfidence)), reason },
    summary: { summary: operationalSummary, knownFacts: stringList(summary.knownFacts, 8, 180), unknownInformation: stringList(summary.unknownInformation, 8, 180), priority },
    recommendation: { requiredSkills: requiredSkills.length ? requiredSkills : [recommendation.recommendedResponderType], recommendedResponderType: recommendation.recommendedResponderType, reason: recommendationReason },
  };
}
