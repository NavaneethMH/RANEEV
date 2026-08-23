export type MapCoordinate = { lat: number; lng: number };
export type EmergencyMapMarkerKind = "current" | "incident" | "responder" | "hospital";

export type EmergencyMapMarker = {
  id: string;
  kind: EmergencyMapMarkerKind;
  title: string;
  position: MapCoordinate;
};

export type EmergencyMapData = {
  incident: EmergencyMapMarker;
  responder?: EmergencyMapMarker;
  currentLocation?: EmergencyMapMarker;
  hospitals?: EmergencyMapMarker[];
  route?: { origin: MapCoordinate; destination: MapCoordinate };
  followResponder?: boolean;
};

export type RouteMetrics = { distanceMeters: number; durationSeconds: number };

export type EmergencyMapController = {
  update: (data: EmergencyMapData) => void;
  recenter: () => void;
  destroy: () => void;
};
