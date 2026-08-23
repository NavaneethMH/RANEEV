import type { EmergencyMapController, EmergencyMapData, EmergencyMapMarker, RouteMetrics } from "./contracts";

const markerColors = { current: "#0e4e78", incident: "#d83232", responder: "#247352", hospital: "#8f5408" } as const;

function markerElement(kind: EmergencyMapMarker["kind"]) {
  const marker = document.createElement("div");
  marker.style.width = kind === "incident" ? "18px" : "15px";
  marker.style.height = kind === "incident" ? "18px" : "15px";
  marker.style.borderRadius = "999px";
  marker.style.background = markerColors[kind];
  marker.style.border = "3px solid #ffffff";
  marker.style.boxShadow = "0 0 0 3px rgba(23,33,43,0.18)";
  return marker;
}

export async function mountGoogleEmergencyMap(map: google.maps.Map, initialData: EmergencyMapData, onRouteMetrics?: (metrics: RouteMetrics | null) => void, onHospitalsFound?: (hospitals: EmergencyMapMarker[]) => void): Promise<EmergencyMapController> {
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
  const directions = new google.maps.DirectionsService();
  const renderer = new google.maps.DirectionsRenderer({ map, suppressMarkers: true, preserveViewport: true, polylineOptions: { strokeColor: "#0e4e78", strokeOpacity: 0.85, strokeWeight: 5 } });
  const markerInstances = new Map<string, google.maps.marker.AdvancedMarkerElement>();
  let lastData = initialData;
  let hospitalSearchToken = 0;
  let lastHospitalKey: string | null = null;
  let lastRouteKey: string | null = null;
  let discoveredHospitals: EmergencyMapMarker[] = [];

  const syncMarkers = (markers: EmergencyMapMarker[]) => {
    const next = new Map(markers.map(marker => [marker.id, marker]));
    markerInstances.forEach((instance, id) => { if (!next.has(id)) { instance.map = null; markerInstances.delete(id); } });
    markers.forEach(marker => {
      const existing = markerInstances.get(marker.id);
      if (existing) { existing.position = marker.position; existing.title = marker.title; return; }
      markerInstances.set(marker.id, new AdvancedMarkerElement({ map, position: marker.position, title: marker.title, content: markerElement(marker.kind) }));
    });
  };

  const fitToData = (data: EmergencyMapData) => {
    const bounds = new google.maps.LatLngBounds();
    [data.incident, data.responder, data.currentLocation, ...(data.hospitals ?? discoveredHospitals), ...(data.additionalMarkers ?? [])].filter(Boolean).forEach(marker => bounds.extend((marker as EmergencyMapMarker).position));
    if (!bounds.isEmpty()) map.fitBounds(bounds, 64);
  };

  const queryHospitals = (data: EmergencyMapData) => {
    const key = `${data.incident.position.lat.toFixed(4)}:${data.incident.position.lng.toFixed(4)}`;
    if (key === lastHospitalKey) return;
    lastHospitalKey = key;
    const token = ++hospitalSearchToken;
    const service = new google.maps.places.PlacesService(map);
    service.nearbySearch({ location: data.incident.position, radius: 5_000, type: "hospital" }, (results, status) => {
      if (token !== hospitalSearchToken || status !== google.maps.places.PlacesServiceStatus.OK || !results) return;
      discoveredHospitals = results.slice(0, 4).flatMap(place => place.geometry?.location ? [{ id: `hospital-${place.place_id ?? place.name}`, kind: "hospital" as const, title: place.name ?? "Nearby hospital", position: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() } }] : []);
      syncMarkers([lastData.incident, ...(lastData.responder ? [lastData.responder] : []), ...(lastData.currentLocation ? [lastData.currentLocation] : []), ...(lastData.hospitals ?? discoveredHospitals), ...(lastData.additionalMarkers ?? [])]);
      onHospitalsFound?.(discoveredHospitals);
    });
  };

  const render = (data: EmergencyMapData) => {
    lastData = data;
    syncMarkers([data.incident, ...(data.responder ? [data.responder] : []), ...(data.currentLocation ? [data.currentLocation] : []), ...(data.hospitals ?? discoveredHospitals), ...(data.additionalMarkers ?? [])]);
    queryHospitals(data);
    const routeOrigin = data.route?.origin ?? data.responder?.position;
    const routeDestination = data.route?.destination ?? data.incident.position;
    if (routeOrigin) {
      const routeKey = data.route
        ? `fixed:${data.route.origin.lat.toFixed(5)}:${data.route.origin.lng.toFixed(5)}:${data.route.destination.lat.toFixed(5)}:${data.route.destination.lng.toFixed(5)}`
        : `live:${routeOrigin.lat.toFixed(5)}:${routeOrigin.lng.toFixed(5)}:${routeDestination.lat.toFixed(5)}:${routeDestination.lng.toFixed(5)}`;
      if (routeKey !== lastRouteKey) {
        lastRouteKey = routeKey;
        directions.route({ origin: routeOrigin, destination: routeDestination, travelMode: google.maps.TravelMode.DRIVING }, (result, status) => {
          if (status !== google.maps.DirectionsStatus.OK || !result) { onRouteMetrics?.(null); return; }
          renderer.setDirections(result);
          const leg = result.routes[0]?.legs[0];
          onRouteMetrics?.(leg?.distance?.value && leg?.duration?.value ? { distanceMeters: leg.distance.value, durationSeconds: leg.duration.value } : null);
        });
      }
    } else { lastRouteKey = null; onRouteMetrics?.(null); }
    fitToData(data);
  };

  render(initialData);
  return { update: render, recenter: () => fitToData(lastData), destroy: () => { markerInstances.forEach(marker => { marker.map = null; }); markerInstances.clear(); renderer.setMap(null); } };
}
