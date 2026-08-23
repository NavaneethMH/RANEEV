export const aiCategories = ["medical", "accident", "fire", "missing_person", "violence", "natural_disaster", "other"] as const;
export const aiSeverities = ["low", "moderate", "high", "critical", "unknown"] as const;
export const responderTypes = ["medical", "fire_safety", "traffic_control", "search_support", "general_response"] as const;

export type AiCategory = (typeof aiCategories)[number];
export type AiSeverity = (typeof aiSeverities)[number];
export type ResponderType = (typeof responderTypes)[number];

export type IncidentEnrichment = {
  classification: { category: AiCategory; severity: AiSeverity; recommendedResponderType: ResponderType; confidence: number; reason: string };
  summary: { summary: string; knownFacts: string[]; unknownInformation: string[]; priority: AiSeverity };
  recommendation: { requiredSkills: ResponderType[]; recommendedResponderType: ResponderType; reason: string };
};

export type CandidateResponder = {
  userId: number;
  name: string;
  distanceMeters: number;
  availability: "offline" | "available" | "busy";
  verified: boolean;
  skills: string[];
};

export type ScoredResponder = CandidateResponder & { score: number; skillMatch: number; explanation: string };
