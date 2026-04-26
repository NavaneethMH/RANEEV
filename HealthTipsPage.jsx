import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ArrowLeft, Volume2 } from "lucide-react";
import { speakText, isSpeechSynthesisSupported } from "../utils/voiceUtils";

const healthTips = [
  {
    id: 1,
    title: "Heart Attack - Do's & Don'ts",
    icon: "❤️",
    content: [
      "DO: Call emergency (100) immediately",
      "DO: Chew aspirin if available (unless allergic)",
      "DO: Loosen tight clothing",
      "DO: Sit or lie down and rest",
      "DO: Stay calm and let someone know",
      "DON'T: Delay seeking medical help",
      "DON'T: Eat or drink anything",
      "DON'T: Overexert yourself",
    ],
  },
  {
    id: 2,
    title: "Severe Bleeding Control",
    icon: "🩸",
    content: [
      "DO: Apply direct pressure with a clean cloth",
      "DO: Keep the wound elevated if possible",
      "DO: Apply a tourniquet above the wound if limb bleeding",
      "DO: Call emergency immediately",
      "DO: Monitor vital signs",
      "DON'T: Remove the cloth if soaked (add another on top)",
      "DON'T: Apply tourniquets on neck or torso",
      "DON'T: Move the injured person unnecessarily",
    ],
  },
  {
    id: 3,
    title: "Choking Person - Heimlich Maneuver",
    icon: "🫁",
    content: [
      "Step 1: Ask 'Are you choking?' - if they can't speak, act immediately",
      "Step 2: Stand behind the person",
      "Step 3: Place fist above navel, below ribcage",
      "Step 4: Grasp fist with other hand",
      "Step 5: Perform quick, upward thrusts",
      "Step 6: Repeat until object is dislodged",
      "Step 7: Call emergency if unsuccessful",
      "Note: For infants, use back blows and chest thrusts",
    ],
  },
  {
    id: 4,
    title: "Stroke - FAST Method",
    icon: "🧠",
    content: [
      "F (Face): Check for facial drooping",
      "A (Arm): Check for arm weakness",
      "S (Speech): Check for speech difficulty",
      "T (Time): Note the time symptoms started",
      "URGENT: Call 100 immediately if any sign",
      "DO: Note exact time of symptom onset",
      "DO: Monitor consciousness",
      "Time is critical - every minute counts!",
    ],
  },
  {
    id: 5,
    title: "Burns Treatment",
    icon: "🔥",
    content: [
      "Step 1: Cool the burn with running water (15-20 min)",
      "Step 2: Remove tight jewelry or clothing",
      "Step 3: Apply sterile, non-stick dressing",
      "Step 4: Take over-the-counter pain relief",
      "Step 5: Seek medical help for serious burns",
      "DON'T: Apply ice directly to skin",
      "DON'T: Use oil or butter",
      "DON'T: Pop blisters",
    ],
  },
  {
    id: 6,
    title: "Fracture/Bone Injury",
    icon: "🦴",
    content: [
      "DO: Immobilize the injured area immediately",
      "DO: Apply ice wrapped in cloth (15-20 min intervals)",
      "DO: Elevate the injured limb",
      "DO: Call emergency or go to hospital",
      "DO: Keep the person calm and comfortable",
      "DON'T: Move the injured limb unnecessarily",
      "DON'T: Apply ice directly to skin",
      "DON'T: Give food or water if surgery might be needed",
    ],
  },
  {
    id: 7,
    title: "CPR (Cardiopulmonary Resuscitation)",
    icon: "💪",
    content: [
      "Step 1: Check if person is responsive",
      "Step 2: Call emergency (100) immediately",
      "Step 3: Place person on firm, flat surface",
      "Step 4: Tilt head back, lift chin",
      "Step 5: Start chest compressions - 100-120 per minute",
      "Step 6: Alternate 30 compressions with 2 rescue breaths",
      "Step 7: Continue until emergency arrives or signs of life",
      "Note: Hands-only CPR (compressions only) is also effective",
    ],
  },
  {
    id: 8,
    title: "Poisoning/Overdose",
    icon: "☠️",
    content: [
      "DO: Call emergency (100) immediately",
      "DO: Remove the person from toxic environment",
      "DO: If conscious, give activated charcoal if available",
      "DO: Keep the substance container for info",
      "DO: Loosen tight clothing",
      "DON'T: Induce vomiting unless instructed",
      "DON'T: Give food or drinks",
      "DON'T: Leave the person alone",
    ],
  },
];

export default function HealthTipsPage({ setCurrentPage }) {
  const [expandedTip, setExpandedTip] = useState(null);

  const handleSpeak = (tip) => {
    if (isSpeechSynthesisSupported()) {
      const fullText = `${tip.title}. ${tip.content.join(". ")}`;
      speakText(fullText, { rate: 0.8 });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-green-600 to-green-800 text-white p-6 rounded-b-3xl shadow-lg flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentPage("home")} className="hover:bg-white/20 p-2 rounded-lg">
            <ArrowLeft size={28} />
          </button>
          <h1 className="text-3xl font-bold">🏥 First Aid Guide</h1>
        </div>
      </motion.div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-yellow-50 border-l-4 border-yellow-400 p-4 m-6 rounded-lg"
      >
        <h3 className="font-bold text-yellow-800 mb-2">⚠️ Important Notice</h3>
        <p className="text-yellow-700 text-sm">
          This guide is for informational purposes only. Always call emergency services (100) immediately for serious medical emergencies.
        </p>
      </motion.div>

      {/* Tips List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="px-6 space-y-3"
      >
        {healthTips.map((tip, index) => (
          <motion.div
            key={tip.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition"
          >
            <motion.button
              onClick={() => setExpandedTip(expandedTip === tip.id ? null : tip.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition font-bold text-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{tip.icon}</span>
                <span className="text-left text-gray-800">{tip.title}</span>
              </div>
              <motion.div
                animate={{ rotate: expandedTip === tip.id ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown size={24} className="text-gray-600" />
              </motion.div>
            </motion.button>

            {expandedTip === tip.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-50 border-t-2 border-gray-200 p-4"
              >
                <ul className="space-y-2 mb-4">
                  {tip.content.map((item, idx) => (
                    <li key={idx} className="flex gap-2 text-gray-700 text-sm">
                      <span className="text-green-600 font-bold">{item.includes("DO") || item.includes("Step") ? "✓" : "✗"}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {isSpeechSynthesisSupported() && (
                  <button
                    onClick={() => handleSpeak(tip)}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Volume2 size={18} />
                    Listen to this guide
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Emergency Numbers */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 m-6"
      >
        <h3 className="font-bold text-red-800 mb-3">🚨 Emergency Numbers</h3>
        <div className="space-y-2 text-sm text-red-700">
          <p>📞 Police: 100</p>
          <p>🚑 Ambulance: 102</p>
          <p>🚒 Fire: 101</p>
          <p>💬 Women Helpline: 1091</p>
        </div>
      </motion.div>
    </div>
  );
}
