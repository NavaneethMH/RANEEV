import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, Phone, Navigation, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

const hospitalData = [
  { id: 1, name: "City General Hospital", type: "General", beds: 500, emergency: true, phone: "100", lat: 28.6139, lng: 77.209 },
  { id: 2, name: "Cardiac Care Center", type: "Specialty", beds: 200, emergency: true, phone: "101", lat: 28.5355, lng: 77.391 },
  { id: 3, name: "Trauma & Ortho", type: "Specialty", beds: 150, emergency: true, phone: "102", lat: 28.7041, lng: 77.1025 },
  { id: 4, name: "Mother & Child Hospital", type: "Specialty", beds: 300, emergency: true, phone: "103", lat: 28.4089, lng: 77.0165 },
  { id: 5, name: "Neuro Institute", type: "Specialty", beds: 180, emergency: false, phone: "104", lat: 28.5667, lng: 77.1667 },
];

export default function HospitalFinderPage({ userLocation, setCurrentPage }) {
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [filterEmergency, setFilterEmergency] = useState(true);

  const filteredHospitals = useMemo(
    () => hospitalData.filter((h) => !filterEmergency || h.emergency),
    [filterEmergency]
  );

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  };

  const sortedHospitals = filteredHospitals.sort((a, b) => {
    if (!userLocation) return 0;
    const distA = parseFloat(calculateDistance(userLocation.latitude, userLocation.longitude, a.lat, a.lng));
    const distB = parseFloat(calculateDistance(userLocation.latitude, userLocation.longitude, b.lat, b.lng));
    return distA - distB;
  });

  const handleCall = (hospital) => {
    window.location.href = `tel:${hospital.phone}`;
    toast.success(`Calling ${hospital.name}...`);
  };

  const handleNavigate = (hospital) => {
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}`;
    window.open(mapsUrl, "_blank");
    toast.success(`Opening directions...`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-red-600 to-red-800 text-white p-6 rounded-b-3xl shadow-lg flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentPage("home")} className="hover:bg-white/20 p-2 rounded-lg">
            <ArrowLeft size={28} />
          </button>
          <h1 className="text-3xl font-bold">🏥 Hospitals</h1>
        </div>
      </motion.div>

      {/* Filter */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="p-6"
      >
        <button
          onClick={() => setFilterEmergency(!filterEmergency)}
          className={`w-full p-4 rounded-2xl font-bold text-lg transition-all ${
            filterEmergency ? "bg-red-500 text-white shadow-lg" : "bg-gray-100 text-gray-800"
          }`}
        >
          {filterEmergency ? "🚑 Emergency Hospitals Only" : "✓ Showing All Hospitals"}
        </button>
      </motion.div>

      {/* Hospital List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="px-6 space-y-4"
      >
        {sortedHospitals.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No hospitals found</p>
          </div>
        ) : (
          sortedHospitals.map((hospital, index) => {
            const distance =
              userLocation &&
              calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                hospital.lat,
                hospital.lng
              );
            return (
              <motion.div
                key={hospital.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedHospital(hospital)}
                className="bg-white border-2 border-gray-200 rounded-2xl p-4 shadow-md hover:shadow-lg transition cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{hospital.name}</h3>
                    <p className="text-sm text-gray-500">{hospital.type}</p>
                  </div>
                  {hospital.emergency && (
                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-bold">🚑 24/7</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-gray-600 text-xs">Beds</p>
                    <p className="font-bold text-blue-600">{hospital.beds}</p>
                  </div>
                  {distance && (
                    <div className="bg-green-50 rounded-lg p-2">
                      <p className="text-gray-600 text-xs">Distance</p>
                      <p className="font-bold text-green-600">{distance} km</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCall(hospital);
                    }}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm"
                  >
                    <Phone size={16} /> Call
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNavigate(hospital);
                    }}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm"
                  >
                    <Navigation size={16} /> Navigate
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-red-50 border-l-4 border-red-400 p-4 m-6 rounded-lg"
      >
        <h3 className="font-bold text-red-800 mb-2">📍 Sorted by Distance</h3>
        <p className="text-red-700 text-sm">Hospitals are shown in order of proximity to your current location for faster access.</p>
      </motion.div>
    </div>
  );
}
