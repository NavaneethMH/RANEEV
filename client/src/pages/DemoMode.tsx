import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, CheckCircle2, Clock3, FastForward, MapPin, Pause, Play, Presentation, RefreshCcw, Route, ShieldAlert, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { EmergencyMap } from "@/components/EmergencyMap";
import { Button } from "@/components/ui/button";
import { ConsoleShell, Metric, OperationalAlert, PageHeading, StatusBadge, SurfaceCard } from "@/components/RaneevUI";
import { trpc } from "@/lib/trpc";

const demoActorEmails = new Set(["citizen.demo@raneev.test", "volunteer.demo@raneev.test", "coordinator.demo@raneev.test", "admin.demo@raneev.test"]);
const presenterEmails = new Set(["coordinator.demo@raneev.test", "admin.demo@raneev.test"]);
const stages = ["new_emergency", "responder_detected", "responder_accepted", "responder_moving", "responder_arrived", "incident_resolved"] as const;
const stageCopy = {
  new_emergency: { label: "New emergency", tone: "critical" as const, detail: "A controlled road-accident scenario is active." },
  responder_detected: { label: "Responder detected", tone: "warning" as const, detail: "Arjun Kumar — Demo Responder is 1.6 km from the demo location." },
  responder_accepted: { label: "Responder accepted", tone: "info" as const, detail: "The responder is assigned and the predefined route is ready." },
  responder_moving: { label: "Responder moving", tone: "info" as const, detail: "The responder marker follows the deterministic route toward the incident." },
  responder_arrived: { label: "Responder arrived", tone: "safe" as const, detail: "The responder and demo incident are co-located." },
  incident_resolved: { label: "Incident resolved", tone: "safe" as const, detail: "The controlled response is complete and demo metrics are available." },
};

function displayTime(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60).toString().padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function DemoMode() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [presentationMode, setPresentationMode] = useState(false);
  const allowed = Boolean(user && demoActorEmails.has(user.email));
  const presenter = Boolean(user && presenterEmails.has(user.email));
  const utils = trpc.useUtils();
  const status = trpc.demo.status.useQuery(undefined, { enabled: allowed, refetchInterval: 1_000, retry: false });
  const refresh = () => {
    void utils.demo.status.invalidate();
    void utils.incidents.active.invalidate();
    void utils.incidents.mine.invalidate();
    void utils.coordinator.commandCenter.invalidate();
    void utils.notifications.inbox.invalidate();
  };
  const controls = {
    start: trpc.demo.start.useMutation({ onSuccess: refresh }),
    pause: trpc.demo.pause.useMutation({ onSuccess: refresh }),
    resume: trpc.demo.resume.useMutation({ onSuccess: refresh }),
    skip: trpc.demo.skip.useMutation({ onSuccess: refresh }),
    reset: trpc.demo.reset.useMutation({ onSuccess: refresh }),
  };
  const run = async (action: keyof typeof controls) => {
    try { await controls[action].mutateAsync(); }
    catch (error) { toast(error instanceof Error ? error.message : "Demo Mode action could not be completed."); }
  };

  const data = status.data;
  const stage = data?.stage ?? "new_emergency";
  const current = stageCopy[stage];
  const incident = data?.incident;
  const mapData = useMemo(() => incident ? {
    incident: { id: incident.publicId, kind: "incident" as const, title: "RNV Demo Road Accident", position: { lat: incident.latitudeE6 / 1_000_000, lng: incident.longitudeE6 / 1_000_000 } },
    responder: stage === "new_emergency" ? undefined : { id: "demo-responder", kind: "responder" as const, title: data.actorNames.volunteer, position: { lat: data.responderPlan.latitude, lng: data.responderPlan.longitude } },
    route: stage === "new_emergency" || stage === "responder_detected" ? undefined : { origin: { lat: 12.9698, lng: 77.5889 }, destination: { lat: incident.latitudeE6 / 1_000_000, lng: incident.longitudeE6 / 1_000_000 } },
    followResponder: stage === "responder_moving",
  } : null, [data, incident, stage]);

  if (!allowed) return <div className="min-h-screen bg-[#f6f4ef] px-6 py-12"><SurfaceCard tone="warning" className="mx-auto max-w-xl p-7"><StatusBadge tone="warning" label="Demo access" /><h1 className="mt-4 text-3xl font-extrabold tracking-[-0.05em] text-[#17212b]">RANEEV Demo Mode is restricted.</h1><p className="mt-3 text-sm font-medium leading-6 text-[#52626c]">Sign in with a designated fictional RANEEV demo account to access the controlled presentation environment.</p><Link href="/login" className="rn-focus mt-6 inline-flex min-h-11 items-center rounded-lg bg-[#0e4e78] px-4 text-sm font-extrabold text-white">Return to sign in</Link></SurfaceCard></div>;
  if (status.isLoading || !data) return <ConsoleShell role={user!.role}><PageHeading eyebrow="RANEEV demo mode" title="Preparing controlled scenario." description="Retrieving the isolated simulation state and verified demo actors." /><SurfaceCard tone="info" className="p-6"><p className="text-sm font-extrabold">Loading Demo Mode…</p></SurfaceCard></ConsoleShell>;

  const paused = data.status === "paused";
  const running = data.status === "running";
  const complete = data.status === "completed";
  const busy = Object.values(controls).some(control => control.isPending);
  return <ConsoleShell role={user!.role}><PageHeading eyebrow="RANEEV demo mode" title={presentationMode ? "Live presentation view" : "Deterministic emergency response demo"} description="A controlled, isolated simulation. No real emergency, user, responder, or SMS delivery is involved." action={<div className="flex flex-wrap gap-2"><StatusBadge tone="warning" label="Demo data only" /><button onClick={() => setPresentationMode(value => !value)} className="rn-focus inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#0e4e78] bg-white px-2.5 text-[0.65rem] font-extrabold uppercase tracking-[0.08em] text-[#0e4e78]"><Presentation className="h-3.5 w-3.5" />{presentationMode ? "Exit presentation" : "Presentation mode"}</button></div>} />
    <OperationalAlert tone="warning" title="Controlled demonstration environment">This simulation uses the shared incident and timeline architecture, but all records are marked as demo data and excluded from normal operational queues.</OperationalAlert>
    <div className="mt-6 grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-5">
        {mapData ? <EmergencyMap data={mapData} label={stage === "responder_moving" ? "DEMO · Responder movement" : "DEMO · Controlled incident map"} /> : <SurfaceCard tone="critical" className="min-h-[22rem] p-6"><MapPin className="h-9 w-9 text-[#d83232]" /><h2 className="mt-4 text-xl font-extrabold">Map ready for a controlled emergency.</h2><p className="mt-2 max-w-md text-sm font-medium leading-6 text-[#52626c]">Start Demo to insert the isolated road-accident record and show its predefined incident marker.</p></SurfaceCard>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Golden hour" value={displayTime(data.elapsedSeconds)} sub={complete ? "Response completed" : paused ? "Simulation paused" : "Simulation active"} tone={complete ? "safe" : "critical"} /><Metric label="ETA" value={stage === "new_emergency" || stage === "responder_detected" ? "—" : `${data.responderPlan.etaMinutes} min`} sub="Demo responder route" tone="info" /><Metric label="Distance" value={`${data.responderPlan.distanceKm.toFixed(1)} km`} sub="Predefined scenario" tone="info" /><Metric label="Stage" value={`${stages.indexOf(stage) + 1}/6`} sub={current.label} tone={current.tone} /></div>
      </div>
      <div className="space-y-4">
        <SurfaceCard tone={current.tone} className="p-6"><div className="flex items-center justify-between gap-3"><StatusBadge tone={current.tone} label={current.label} /><span className="rn-mono text-xs font-semibold text-[#60707c]">{data.incident?.publicId ?? "RNV-DEMO-001"}</span></div><h2 className="mt-4 text-2xl font-extrabold tracking-[-0.05em] text-[#17212b]">Road accident · Critical</h2><p className="mt-2 text-sm font-medium leading-6 text-[#52626c]">{current.detail}</p><div className="mt-5 grid grid-cols-2 gap-3 border-y border-[#edf0ee] py-4"><div><p className="rn-eyebrow">Affected people</p><p className="mt-1 text-sm font-extrabold">2 · Demo scenario</p></div><div><p className="rn-eyebrow">Responder</p><p className="mt-1 text-sm font-extrabold">{data.actorNames.volunteer}</p></div></div><div className="mt-5 flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#0e4e78]" /><div><p className="text-sm font-extrabold">AI-assisted classification</p><p className="mt-1 text-xs font-medium leading-5 text-[#60707c]">Deterministic fallback: Road Accident · Critical · First Aid / Medical responder recommended.</p></div></div></SurfaceCard>
        {!presentationMode && <SurfaceCard tone="neutral" className="p-5"><div className="flex items-center justify-between"><div><p className="rn-eyebrow">Presenter controls</p><p className="mt-1 text-sm font-extrabold">Current: {current.label}</p></div><Clock3 className="h-5 w-5 text-[#0e4e78]" /></div>{presenter ? <div className="mt-4 grid grid-cols-2 gap-2"><Button disabled={busy || running || complete} onClick={() => run("start")} className="rn-touch bg-[#d83232] text-xs font-extrabold text-white hover:bg-[#b82727]"><Play className="h-4 w-4" />Start Demo</Button><Button disabled={busy || !running} onClick={() => run("pause")} variant="outline" className="rn-touch border-[#b86d0a] text-xs font-extrabold text-[#8f5408]"><Pause className="h-4 w-4" />Pause</Button><Button disabled={busy || !paused} onClick={() => run("resume")} className="rn-touch bg-[#0e4e78] text-xs font-extrabold text-white hover:bg-[#0b3e61]"><Play className="h-4 w-4" />Resume</Button><Button disabled={busy || !data.incident || complete} onClick={() => run("skip")} variant="outline" className="rn-touch border-[#0e4e78] text-xs font-extrabold text-[#0e4e78]"><FastForward className="h-4 w-4" />Next stage</Button><Button disabled={busy || (!data.incident && data.status === "idle")} onClick={() => run("reset")} variant="outline" className="rn-touch border-[#60707c] text-xs font-extrabold text-[#43535e]"><RefreshCcw className="h-4 w-4" />Reset Demo</Button><Button onClick={() => setLocation("/coordinator")} variant="outline" className="rn-touch border-[#cbd5d6] text-xs font-extrabold text-[#43535e]"><X className="h-4 w-4" />Exit Demo</Button></div> : <OperationalAlert tone="info" title="View-only Demo Mode">Only the designated Demo Coordinator or Demo Administrator can control this simulation.</OperationalAlert>}</SurfaceCard>}
      </div>
    </div>
    <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <SurfaceCard tone="info" className="p-6"><div className="flex items-center justify-between"><div><p className="rn-eyebrow">Deterministic timeline</p><h2 className="mt-2 text-xl font-extrabold tracking-[-0.04em]">Shared incident progression</h2></div><Route className="h-6 w-6 text-[#0e4e78]" /></div><div className="mt-5 space-y-0">{stages.map((item, index) => { const itemCopy = stageCopy[item]; const done = stages.indexOf(stage) >= index; return <div key={item} className="flex gap-3 border-l-2 border-[#d7dddc] pb-4 pl-4 last:pb-0"><span className={`-ml-[1.55rem] mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ${done ? "bg-[#247352] text-white" : "bg-[#d7dddc] text-[#60707c]"}`}>{done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-[0.58rem] font-extrabold">{index + 1}</span>}</span><div><p className="text-sm font-extrabold text-[#17212b]">{itemCopy.label}</p><p className="mt-0.5 text-xs font-medium text-[#60707c]">{itemCopy.detail}</p></div></div>; })}</div></SurfaceCard>
      <SurfaceCard tone="safe" className="p-6"><p className="rn-eyebrow">Demo metrics</p><h2 className="mt-2 text-xl font-extrabold tracking-[-0.04em]">Controlled response summary</h2><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between border-b border-[#edf0ee] pb-2"><span className="font-semibold text-[#60707c]">Responder detection</span><span className="font-extrabold">{data.metrics.responderDetectionSeconds} sec</span></div><div className="flex justify-between border-b border-[#edf0ee] pb-2"><span className="font-semibold text-[#60707c]">Acceptance</span><span className="font-extrabold">{data.metrics.acceptanceSeconds} sec</span></div><div className="flex justify-between border-b border-[#edf0ee] pb-2"><span className="font-semibold text-[#60707c]">Travel time</span><span className="font-extrabold">{data.metrics.travelSeconds} sec</span></div><div className="flex justify-between border-b border-[#edf0ee] pb-2"><span className="font-semibold text-[#60707c]">Responder arrival</span><span className="font-extrabold">{data.metrics.totalResponseSeconds} sec</span></div><div className="flex justify-between"><span className="font-semibold text-[#60707c]">Resolution</span><span className="font-extrabold">{data.metrics.resolutionSeconds} sec</span></div></div><div className="mt-5 flex gap-2 rounded-lg border border-[#bfe0ce] bg-[#f2faf5] p-3 text-xs font-medium leading-5 text-[#52626c]"><ShieldAlert className="h-4 w-4 shrink-0 text-[#247352]" />These are Demo Metrics for a controlled scenario, not production analytics.</div></SurfaceCard>
    </section>
  </ConsoleShell>;
}
