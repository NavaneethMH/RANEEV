import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type CitizenEmergencyType = "medical" | "road_accident" | "injury" | "fire" | "unconscious" | "missing_person" | "violence" | "natural_disaster" | "other";

export type EmergencyDraft = {
  emergencyType: CitizenEmergencyType;
  locationLabel: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  description: string;
};

const initialDraft: EmergencyDraft = {
  emergencyType: "road_accident",
  locationLabel: "NH 44 service road, Devanahalli",
  latitude: 13.1986,
  longitude: 77.7102,
  accuracyMeters: 18,
  description: "",
};

type EmergencyDraftContextValue = {
  draft: EmergencyDraft;
  updateDraft: (next: Partial<EmergencyDraft>) => void;
  resetDraft: () => void;
};

const EmergencyDraftContext = createContext<EmergencyDraftContextValue | null>(null);

export function EmergencyDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<EmergencyDraft>(initialDraft);
  const value = useMemo(() => ({
    draft,
    updateDraft: (next: Partial<EmergencyDraft>) => setDraft(current => ({ ...current, ...next })),
    resetDraft: () => setDraft(initialDraft),
  }), [draft]);
  return <EmergencyDraftContext.Provider value={value}>{children}</EmergencyDraftContext.Provider>;
}

export function useEmergencyDraft() {
  const context = useContext(EmergencyDraftContext);
  if (!context) throw new Error("useEmergencyDraft must be used within EmergencyDraftProvider");
  return context;
}
