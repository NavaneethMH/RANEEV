import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Building2, CheckCircle2, Clock3, PhoneCall, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AiIncidentInsight } from "@/components/AiIncidentInsight";
import { EmergencyMap } from "@/components/EmergencyMap";
import { BackLink, OperationalAlert, PageHeading, StatePreview, StatusBadge, SurfaceCard } from "@/components/RaneevUI";
import { trpc } from "@/lib/trpc";
import type { EmergencyMapMarker, RouteMetrics } from "@/lib/maps/contracts";

const emergencyLabels: Record<string, string> = {
  medical: "Medical emergency", road_accident: "Road accident", injury: "Injury", fire: "Fire concern",
  unconscious: "Unconscious person", missing_person: "Missing person", violence: "Violence or safety threat",
  natural_disaster: "Natural disaster", other: "Emergency request",
};
const severityMeta = {
  unassessed: { label: "Unassessed", tone: "neutral" as const, description: "Awaiting an operational priority review." },
  standard: { label: "Standard", tone: "info" as const, description: "Continue active coordination." },
  urgent: { label: "Urgent", tone: "warning" as const, description: "Compress handoffs and review escalation." },
  critical: { label: "Critical", tone: "critical" as const, description: "Prioritize professional-service coordination." },
};
const escalationMeta = {
  not_escalated: { label: "Not escalated", tone: "neutral" as const },
  monitoring: { label: "Monitoring", tone: "info" as const },
  facility_contacted: { label: "Facility contacted", tone: "warning" as const },
  professional_services_contacted: { label: "Professional services contacted", tone: "critical" as const },
};

function formatElapsed(value: number) {
  const seconds = Math.max(0, Math.floor(value / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return `${hours ? `${String(hours).padStart(2, "0")}:` : ""}${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function TimeSinceIncident({ createdAt }: { createdAt: Date | string }) {
  const startedAt = new Date(createdAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return <div className="border-l-4 border-[#d83232] bg-[#fff7f4] px-4 py-3 shadow-[var(--rn-shadow-sm)]">
    <div className="flex items-center gap-2 text-[#a52828]"><Clock3 className="h-4 w-4" /><span className="text-[0.65rem] font-extrabold uppercase tracking-[0.13em]">Time since incident</span></div>
    <p role="timer" aria-live="polite" className="mt-1 rn-mono text-3xl font-extrabold tracking-[-0.06em] text-[#17212b]">{formatElapsed(now - startedAt)}</p>
    <p className="mt-1 text-xs font-semibold text-[#60707c]">Started {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
  </div>;
}

function incidentTone(status: string) {
  if (["resolved", "cancelled"].includes(status)) return "safe" as const;
  if (["arrived", "assisting"].includes(status)) return "info" as const;
  if (["accepted", "en_route"].includes(status)) return "warning" as const;
  return "critical" as const;
}

export function GoldenHourResponse({ publicId }: { publicId?: string }) {
  const activeIncidents = trpc.coordinator.activeIncidents.useQuery(undefined, { enabled: !publicId, refetchInterval: 15_000 });
  const active = activeIncidents.data?.filter(incident => !["resolved", "cancelled"].includes(incident.status)) ?? [];
  if (!publicId) return <>
    <PageHeading eyebrow="Golden Hour Response" title="Open the time-critical incident sequence." description="GHR is an operational layer on the existing emergency record—not a parallel dashboard. Select an active incident to coordinate the next safest response." action={<StatusBadge tone="critical" label={`${active.length} active`} />} />
    <div className="grid gap-5 xl:grid-cols-[1fr_0.42fr]">
      <SurfaceCard tone="critical" className="p-6">
        <div className="flex items-center gap-3"><TimerReset className="h-6 w-6 text-[#d83232]" /><div><p className="text-lg font-extrabold">Active incident queue</p><p className="mt-1 text-xs font-semibold text-[#60707c]">Prioritize elapsed time, response state, and appropriate facility coordination.</p></div></div>
        <div className="mt-5 divide-y divide-[#edf0ee]">{activeIncidents.isLoading ? <p className="py-8 text-sm font-semibold text-[#60707c]">Loading protected incident queue…</p> : active.length ? active.map(incident => <Link key={incident.id} href={`/coordinator/ghr/${incident.publicId}`} className="rn-focus flex min-h-20 items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"><div><p className="text-sm font-extrabold text-[#17212b]">{emergencyLabels[incident.emergencyType] ?? incident.emergencyType}</p><p className="mt-1 text-xs font-semibold text-[#60707c]">{incident.publicId} · {incident.locationLabel}</p></div><StatusBadge tone={incidentTone(incident.status)} label={incident.status.replace("_", " ")} /></Link>) : <p className="rounded-lg border border-dashed border-[#cad4d5] p-5 text-sm font-semibold text-[#60707c]">No active shared incidents need Golden Hour coordination.</p>}</div>
      </SurfaceCard>
      <div className="space-y-4"><OperationalAlert tone="warning" title="Operational priority only">Severity labels coordinate response effort; they are not a medical diagnosis. Contact local professional emergency services whenever available.</OperationalAlert><StatePreview compact /></div>
    </div>
  </>;
  return <GoldenHourIncidentWorkspace publicId={publicId} />;
}

function GoldenHourIncidentWorkspace({ publicId }: { publicId: string }) {
  const [, setLocation] = useLocation();
  const input = useMemo(() => ({ publicId }), [publicId]);
  const overview = trpc.ghr.overview.useQuery(input, { refetchInterval: 8_000 });
  const timeline = trpc.incidents.timeline.useQuery(input, { refetchInterval: 8_000 });
  const assignmentCandidates = trpc.coordinator.assignmentCandidates.useQuery(input, { refetchInterval: 8_000 });
  const utils = trpc.useUtils();
  const [routeMetrics, setRouteMetrics] = useState<RouteMetrics | null>(null);
  const [candidateFacilities, setCandidateFacilities] = useState<EmergencyMapMarker[]>([]);
  const [draftFacility, setDraftFacility] = useState<EmergencyMapMarker | null>(null);
  const [escalationNote, setEscalationNote] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const refresh = useCallback(() => {
    void utils.ghr.overview.invalidate({ publicId });
    void utils.incidents.timeline.invalidate({ publicId });
    void utils.coordinator.activeIncidents.invalidate();
    void utils.coordinator.commandCenter.invalidate();
    void utils.coordinator.assignmentCandidates.invalidate({ publicId });
  }, [publicId, utils]);
  const assessSeverity = trpc.ghr.assessSeverity.useMutation({ onSuccess: refresh });
  const selectFacility = trpc.ghr.selectFacility.useMutation({ onSuccess: () => { setDraftFacility(null); refresh(); } });
  const escalate = trpc.ghr.escalate.useMutation({ onSuccess: () => { setEscalationNote(""); refresh(); } });
  const resolve = trpc.ghr.resolve.useMutation({ onSuccess: refresh });
  const assignResponder = trpc.coordinator.assignResponder.useMutation({ onSuccess: refresh });
  const cancelIncident = trpc.coordinator.cancelIncident.useMutation({ onSuccess: () => { setCancellationReason(""); refresh(); } });
  const onRouteMetrics = useCallback((metrics: RouteMetrics | null) => setRouteMetrics(current => current?.distanceMeters === metrics?.distanceMeters && current?.durationSeconds === metrics?.durationSeconds ? current : metrics), []);
  const onHospitalsFound = useCallback((hospitals: EmergencyMapMarker[]) => setCandidateFacilities(current => current.map(item => item.id).join(",") === hospitals.map(item => item.id).join(",") ? current : hospitals), []);

  if (overview.isLoading) return <><BackLink href="/coordinator/ghr" label="Golden Hour queue" /><PageHeading eyebrow="Golden Hour Response" title="Loading the protected incident sequence." description="RANEEV is retrieving the current shared incident, timing, and response context." /><SurfaceCard tone="info" className="p-6"><p className="text-sm font-extrabold">Loading Golden Hour Response…</p></SurfaceCard></>;
  if (!overview.data) return <><BackLink href="/coordinator/ghr" label="Golden Hour queue" /><PageHeading eyebrow="Golden Hour Response" title="Incident unavailable." description="This incident may have been resolved or your authorized access has changed." /><OperationalAlert tone="warning" title="No active record">Return to the Golden Hour queue to select another protected incident.</OperationalAlert></>;

  const incident = overview.data;
  const persistedFacility = incident.ghrFacilityName && incident.ghrFacilityLatitudeE6 !== null && incident.ghrFacilityLongitudeE6 !== null ? { id: `selected-${incident.ghrFacilityPlaceId ?? incident.ghrFacilityName}`, kind: "hospital" as const, title: incident.ghrFacilityName, position: { lat: incident.ghrFacilityLatitudeE6 / 1_000_000, lng: incident.ghrFacilityLongitudeE6 / 1_000_000 } } : null;
  const selectedFacility = draftFacility ?? persistedFacility;
  const incidentPosition = { lat: incident.latitudeE6 / 1_000_000, lng: incident.longitudeE6 / 1_000_000 };
  const mapData = { incident: { id: incident.publicId, kind: "incident" as const, title: "Emergency incident", position: incidentPosition }, responder: incident.responderName && incident.responderLatitudeE6 !== null && incident.responderLongitudeE6 !== null ? { id: `responder-${incident.assignedVolunteerId}`, kind: "responder" as const, title: incident.responderName, position: { lat: incident.responderLatitudeE6 / 1_000_000, lng: incident.responderLongitudeE6 / 1_000_000 } } : undefined, hospitals: selectedFacility ? [selectedFacility] : candidateFacilities, route: selectedFacility ? { origin: incidentPosition, destination: selectedFacility.position } : undefined };
  const severity = severityMeta[incident.ghrSeverity];
  const escalationState = escalationMeta[incident.ghrEscalation];
  const isTerminal = ["resolved", "cancelled"].includes(incident.status);
  const canResolve = ["arrived", "assisting"].includes(incident.status);
  const canManageResponder = ["searching", "accepted", "en_route"].includes(incident.status);
  const responderAvailability = incident.responderAvailability === "busy" ? "Assigned and busy" : incident.responderAvailability === "available" ? "Available" : incident.responderName ? "Assignment active" : "Awaiting assignment";
  const facilityDistance = routeMetrics ? `${(routeMetrics.distanceMeters / 1_000).toFixed(1)} km` : incident.ghrFacilityDistanceMeters ? `${(incident.ghrFacilityDistanceMeters / 1_000).toFixed(1)} km` : "Route pending";
  const facilityEta = routeMetrics ? `${Math.max(1, Math.ceil(routeMetrics.durationSeconds / 60))} min` : incident.ghrFacilityEtaMinutes ? `${incident.ghrFacilityEtaMinutes} min` : "ETA pending";
  const call = async (operation: () => Promise<unknown>, fallback: string) => { try { await operation(); } catch (error) { toast(error instanceof Error ? error.message : fallback); } };
  const saveFacility = () => selectedFacility && call(() => selectFacility.mutateAsync({ publicId, name: selectedFacility.title, placeId: selectedFacility.id.startsWith("hospital-") ? selectedFacility.id.slice(9) : null, latitude: selectedFacility.position.lat, longitude: selectedFacility.position.lng, distanceMeters: routeMetrics?.distanceMeters ?? null, etaMinutes: routeMetrics ? Math.max(1, Math.ceil(routeMetrics.durationSeconds / 60)) : null }), "Facility selection could not be saved.");

  return <>
    <BackLink href="/coordinator/ghr" label="Golden Hour queue" />
    <PageHeading eyebrow="Golden Hour Response · shared incident" title={incident.publicId} description="Coordinate elapsed time, operational priority, verified responder readiness, care-facility routing, escalation, and resolution from this one incident record." action={<StatusBadge tone={incidentTone(incident.status)} label={incident.status.replace("_", " ")} />} />
    <div className="grid gap-4 md:grid-cols-[1fr_0.7fr_0.7fr]">
      <TimeSinceIncident createdAt={incident.createdAt} />
      <SurfaceCard tone={severity.tone} className="p-4"><p className="rn-eyebrow">Operational severity</p><p className="mt-2 text-xl font-extrabold text-[#17212b]">{severity.label}</p><p className="mt-1 text-xs font-semibold leading-5 text-[#60707c]">{severity.description}</p></SurfaceCard>
      <SurfaceCard tone={incident.responderName ? "safe" : "warning"} className="p-4"><p className="rn-eyebrow">Responder availability</p><p className="mt-2 text-xl font-extrabold text-[#17212b]">{incident.responderName ?? "No responder"}</p><p className="mt-1 text-xs font-semibold leading-5 text-[#60707c]">{responderAvailability}</p></SurfaceCard>
    </div>
    <div className="mt-6 grid gap-6 2xl:grid-cols-[1.14fr_0.86fr]">
      <div className="min-w-0 space-y-6">
        <EmergencyMap data={mapData} onRouteMetrics={onRouteMetrics} onHospitalsFound={onHospitalsFound} label={selectedFacility ? "Protected incident-to-facility route" : "Authorized incident and care options"} />
        <SurfaceCard tone="info" className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="rn-eyebrow">Nearest appropriate facility</p><h2 className="mt-2 text-xl font-extrabold tracking-[-0.04em] text-[#17212b]">{selectedFacility ? selectedFacility.title : "Review nearby care options"}</h2><p className="mt-2 text-sm font-semibold text-[#60707c]">{selectedFacility ? `${facilityDistance} · ${facilityEta}` : "Select a verified nearby hospital from the map provider to plan a route and ETA."}</p></div><Building2 className="h-7 w-7 text-[#0e4e78]" /></div>
          {!isTerminal && <div className="mt-5 grid gap-2 sm:grid-cols-2">{candidateFacilities.length ? candidateFacilities.map(facility => <button key={facility.id} onClick={() => { setDraftFacility(facility); setRouteMetrics(null); }} className={`rn-focus min-h-12 rounded-lg border px-3 text-left text-xs font-extrabold transition-colors ${selectedFacility?.id === facility.id ? "border-[#0e4e78] bg-[#e2eff6] text-[#0e4e78]" : "border-[#cbd5d6] bg-white text-[#43535e] hover:border-[#0e4e78]"}`}><span className="block truncate">{facility.title}</span><span className="mt-1 block text-[0.63rem] font-semibold text-[#60707c]">Plan incident-to-facility route</span></button>) : <p className="rounded-lg border border-dashed border-[#cad4d5] p-4 text-xs font-semibold text-[#60707c]">Searching authorized nearby hospital options…</p>}</div>}
          {selectedFacility && !isTerminal && <Button disabled={selectFacility.isPending || !routeMetrics} onClick={saveFacility} className="rn-touch mt-4 w-full bg-[#0e4e78] text-sm font-extrabold text-white hover:bg-[#0b3e61]">{selectFacility.isPending ? "Saving facility plan…" : routeMetrics ? `${draftFacility ? "Confirm" : "Refresh"} ${selectedFacility.title} · ${facilityEta}` : "Calculating facility route…"}</Button>}
          <p className="mt-4 text-xs font-medium leading-5 text-[#60707c]">Facility routing supports operational coordination only. It does not determine clinical suitability or replace professional emergency directions.</p>
        </SurfaceCard>
      </div>
      <div className="min-w-0 space-y-5">
        <AiIncidentInsight publicId={incident.publicId} showResponderSuggestions />
        <SurfaceCard tone="info" className="p-6">
          <p className="rn-eyebrow">Responder coordination</p><h2 className="mt-2 text-xl font-extrabold tracking-[-0.04em]">{incident.assignedVolunteerId ? "Reassign before arrival" : "Assign a verified responder"}</h2><p className="mt-2 text-xs font-semibold leading-5 text-[#60707c]">Only verified, nearby responders who are available now can be selected. Assignment and reassignment are recorded on this shared incident.</p>
          {canManageResponder ? <div className="mt-4 space-y-2">{assignmentCandidates.isLoading ? <p className="rounded-lg border border-dashed border-[#cad4d5] p-4 text-xs font-semibold text-[#60707c]">Checking verified responder availability…</p> : assignmentCandidates.data?.length ? assignmentCandidates.data.map(candidate => <button key={candidate.id} disabled={assignResponder.isPending || candidate.id === incident.assignedVolunteerId} onClick={() => call(() => assignResponder.mutateAsync({ publicId, volunteerUserId: candidate.id }), "Responder assignment could not be saved.")} className="rn-focus flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[#cbd5d6] bg-white px-3 text-left text-xs font-extrabold text-[#0e4e78] hover:bg-[#e2eff6] disabled:opacity-60"><span className="truncate">{candidate.name}</span><span className="shrink-0 text-[0.62rem] uppercase tracking-[0.08em]">{candidate.id === incident.assignedVolunteerId ? "Assigned" : incident.assignedVolunteerId ? "Reassign" : "Assign"}</span></button>) : <p className="rounded-lg border border-dashed border-[#cad4d5] p-4 text-xs font-semibold text-[#60707c]">No verified available responder is currently within the configured response area.</p>}</div> : <p className="mt-4 rounded-lg border border-dashed border-[#cad4d5] p-4 text-xs font-semibold text-[#60707c]">Responder assignment changes are available only before arrival.</p>}
          {canManageResponder && <div className="mt-5 border-t border-[#edf0ee] pt-5"><label className="text-xs font-extrabold text-[#17212b]" htmlFor="cancellation-reason">Cancel response</label><textarea id="cancellation-reason" value={cancellationReason} onChange={event => setCancellationReason(event.target.value)} maxLength={500} placeholder="Required operational reason" className="rn-focus mt-2 min-h-20 w-full resize-y rounded-lg border border-[#cbd5d6] bg-white p-3 text-xs font-semibold text-[#43535e]" /><Button variant="outline" disabled={cancelIncident.isPending || cancellationReason.trim().length < 3} onClick={() => call(() => cancelIncident.mutateAsync({ publicId, reason: cancellationReason.trim() }), "Incident cancellation could not be saved.")} className="rn-touch mt-3 w-full border-[#d83232] text-sm font-extrabold text-[#a52828] hover:bg-[#fff1ef]">{cancelIncident.isPending ? "Cancelling response…" : "Cancel shared response"}</Button></div>}
        </SurfaceCard>
        <SurfaceCard tone="critical" className="p-6"><p className="rn-eyebrow">Severity · escalation</p><h2 className="mt-2 text-xl font-extrabold tracking-[-0.04em]">Set the next response posture.</h2><div className="mt-4 grid grid-cols-2 gap-2">{Object.entries(severityMeta).map(([value, item]) => <button key={value} disabled={isTerminal || assessSeverity.isPending} onClick={() => call(() => assessSeverity.mutateAsync({ publicId, severity: value as keyof typeof severityMeta }), "Severity could not be saved.")} className={`rn-focus min-h-11 rounded-lg border px-3 text-left text-xs font-extrabold ${incident.ghrSeverity === value ? "border-[#17212b] bg-[#17212b] text-white" : "border-[#cbd5d6] bg-white text-[#43535e] hover:border-[#0e4e78]"}`}>{item.label}</button>)}</div><div className="mt-5 border-t border-[#edf0ee] pt-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-extrabold">{escalationState.label}</p><StatusBadge tone={escalationState.tone} label="Escalation" /></div><textarea value={escalationNote} onChange={event => setEscalationNote(event.target.value)} disabled={isTerminal} maxLength={500} placeholder="Operational note (optional)" className="rn-focus mt-3 min-h-20 w-full resize-y rounded-lg border border-[#cbd5d6] bg-white p-3 text-xs font-semibold text-[#43535e]" /><div className="mt-2 grid gap-2">{[["monitoring", "Continue monitoring"], ["facility_contacted", "Record facility contact"], ["professional_services_contacted", "Record professional-service contact"]].map(([value, label]) => <button key={value} disabled={isTerminal || escalate.isPending} onClick={() => call(() => escalate.mutateAsync({ publicId, escalation: value as "monitoring" | "facility_contacted" | "professional_services_contacted", note: escalationNote.trim() || null }), "Escalation could not be saved.")} className="rn-focus min-h-10 rounded-lg border border-[#cbd5d6] bg-white px-3 text-left text-xs font-extrabold text-[#0e4e78] hover:bg-[#e2eff6]"><PhoneCall className="mr-2 inline h-3.5 w-3.5" />{label}</button>)}</div></div></SurfaceCard>
        <SurfaceCard tone={canResolve ? "safe" : "neutral"} className="p-6"><div className="flex items-start gap-3"><CheckCircle2 className={`mt-0.5 h-5 w-5 ${canResolve ? "text-[#247352]" : "text-[#60707c]"}`} /><div><p className="text-sm font-extrabold">Resolution control</p><p className="mt-1 text-xs font-medium leading-5 text-[#60707c]">Golden Hour resolution is available after responder arrival or assistance has begun. It closes the same shared incident record.</p></div></div><Button disabled={!canResolve || resolve.isPending || isTerminal} onClick={() => call(() => resolve.mutateAsync({ publicId }), "Golden Hour Response could not be resolved.")} className="rn-touch mt-5 w-full bg-[#247352] text-sm font-extrabold text-white hover:bg-[#1b5239] disabled:opacity-60">{resolve.isPending ? "Resolving shared incident…" : canResolve ? "Resolve Golden Hour Response" : "Awaiting arrival or assistance"}</Button></SurfaceCard>
        <OperationalAlert tone="warning" title="Professional emergency services">RANEEV complements professional emergency response. Use escalation to document operational contact; it does not place emergency calls.</OperationalAlert>
        <SurfaceCard tone="neutral" className="p-5"><p className="rn-eyebrow">Shared incident timeline</p><div className="mt-3 space-y-3">{timeline.data?.map(event => <div key={event.id} className="border-l-2 border-[#0e4e78] pl-3"><p className="text-xs font-extrabold text-[#17212b]">{event.note}</p><p className="mt-1 rn-mono text-[0.62rem] text-[#60707c]">{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div>) ?? <p className="text-xs font-semibold text-[#60707c]">Loading protected timeline…</p>}</div></SurfaceCard>
      </div>
    </div>
    <div className="mt-6"><StatePreview /></div>
  </>;
}
