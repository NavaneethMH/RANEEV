import { useEffect, useRef, useState } from "react";
import { Crosshair, MapPinned, Navigation, Route, TriangleAlert } from "lucide-react";
import { MapView } from "@/components/Map";
import { mountGoogleEmergencyMap } from "@/lib/maps/googleEmergencyMapAdapter";
import type { EmergencyMapController, EmergencyMapData, EmergencyMapMarker, RouteMetrics } from "@/lib/maps/contracts";

type EmergencyMapProps = { data: EmergencyMapData; className?: string; onRouteMetrics?: (metrics: RouteMetrics | null) => void; onHospitalsFound?: (hospitals: EmergencyMapMarker[]) => void; label?: string };

export function EmergencyMap({ data, className = "", onRouteMetrics, onHospitalsFound, label = "Authorized emergency map" }: EmergencyMapProps) {
  const controller = useRef<EmergencyMapController | null>(null);
  const [ready, setReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const mapDataRef = useRef(data);
  const hospitalsCallbackRef = useRef(onHospitalsFound);
  mapDataRef.current = data;
  hospitalsCallbackRef.current = onHospitalsFound;

  useEffect(() => { if (controller.current) controller.current.update(data); }, [data]);
  useEffect(() => () => controller.current?.destroy(), []);

  if (mapFailed) return <div className={`relative flex min-h-[26rem] min-w-0 flex-col justify-between overflow-hidden rounded-xl border border-[#e8c9c2] bg-[#fff7f4] p-6 ${className}`}><div><div className="flex items-center gap-2 text-[#a12f24]"><TriangleAlert className="h-5 w-5" /><p className="text-sm font-extrabold">Map temporarily unavailable</p></div><p className="mt-3 max-w-md text-sm font-medium leading-6 text-[#52626c]">RANEEV could not load the live map provider. The confirmed incident location and responder status remain available below while the provider is retried.</p></div><div className="border-t border-[#ecd5cf] pt-4"><p className="rn-eyebrow">Confirmed incident location</p><p className="mt-2 rn-mono text-xs font-bold text-[#43535e]">{data.incident.position.lat.toFixed(5)}°, {data.incident.position.lng.toFixed(5)}°</p>{data.responder && <p className="mt-3 text-sm font-extrabold text-[#247352]">Responder position remains server-confirmed.</p>}</div><button onClick={() => { setMapFailed(false); setReady(false); }} className="rn-focus mt-5 min-h-11 self-start rounded-md border border-[#0e4e78] bg-white px-4 text-xs font-extrabold text-[#0e4e78]">Retry map</button></div>;

  return <div className={`relative min-w-0 overflow-hidden rounded-xl border border-[#bfc9cb] bg-[#dfe7e5] ${className}`}>
    <MapView className="h-full min-h-[26rem] w-full" initialCenter={data.incident.position} initialZoom={14} onMapReady={async map => { try { controller.current = await mountGoogleEmergencyMap(map, mapDataRef.current, onRouteMetrics, hospitals => hospitalsCallbackRef.current?.(hospitals)); setReady(true); } catch { setMapFailed(true); } }} onMapError={() => setMapFailed(true)} />
    <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-[#43535e] shadow-[var(--rn-shadow-sm)]"><MapPinned className="h-3.5 w-3.5 text-[#0e4e78]" />{label}</div>
    <button disabled={!ready} onClick={() => controller.current?.recenter()} className="rn-focus absolute right-3 top-3 flex min-h-10 items-center gap-2 rounded-md border border-[#bfc9cb] bg-white px-3 text-xs font-extrabold text-[#0e4e78] shadow-[var(--rn-shadow-sm)] disabled:opacity-60"><Crosshair className="h-4 w-4" />Recenter</button>
    {data.responder && <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-[#bed6e5] bg-white px-3 py-2 shadow-[var(--rn-shadow-sm)]"><Navigation className="h-4 w-4 text-[#0e4e78]" /><div><p className="text-xs font-extrabold text-[#17212b]">Live responder position</p><p className="text-[0.65rem] font-semibold text-[#60707c]">Updated from the authorized incident feed</p></div></div>}
    {data.hospitals?.length ? <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 rounded-lg border border-[#f1d6a4] bg-white px-3 py-2 shadow-[var(--rn-shadow-sm)]"><Route className="h-4 w-4 text-[#b86d0a]" /><span className="text-[0.65rem] font-extrabold text-[#43535e]">Nearby care options</span></div> : null}
  </div>;
}
