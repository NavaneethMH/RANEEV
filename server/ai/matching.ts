import type { CandidateResponder, ScoredResponder } from "./contracts";

export const responderMatchingWeights = Object.freeze({ distance: 40, skill: 25, availability: 20, verification: 15 });

export function parseResponderSkills(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((skill): skill is string => typeof skill === "string").map(skill => skill.slice(0, 40)).slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function scoreResponders(candidates: CandidateResponder[], requiredSkills: string[]) : ScoredResponder[] {
  const required = new Set(requiredSkills);
  return candidates.map(candidate => {
    const distanceScore = Math.max(0, 1 - Math.min(candidate.distanceMeters, 10_000) / 10_000) * responderMatchingWeights.distance;
    const matchingSkills = candidate.skills.filter(skill => required.has(skill));
    const skillMatch = required.size ? matchingSkills.length / required.size : 1;
    const score = Math.round((distanceScore + skillMatch * responderMatchingWeights.skill + (candidate.availability === "available" ? responderMatchingWeights.availability : 0) + (candidate.verified ? responderMatchingWeights.verification : 0)) * 10) / 10;
    const explanation = `${Math.round(candidate.distanceMeters / 100) / 10} km · ${candidate.availability === "available" ? "available" : candidate.availability} · ${candidate.verified ? "verified" : "not verified"}${matchingSkills.length ? ` · skills: ${matchingSkills.join(", ")}` : ""}`;
    return { ...candidate, score, skillMatch, explanation };
  }).sort((left, right) => right.score - left.score || left.distanceMeters - right.distanceMeters || left.userId - right.userId);
}
