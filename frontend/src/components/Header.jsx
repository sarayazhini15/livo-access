import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Loader2 } from "lucide-react";
import { listenOnce, isSpeechRecognitionSupported, speak } from "@/lib/speech";

function routeFor(transcript) {
  const t = transcript.toLowerCase();
  if (t.includes("home") || t.includes("main")) return { path: "/", say: "Going home." };
  if (t.includes("bill") || t.includes("receipt")) return { path: "/bill-checker", say: "Opening Bill Checker." };
  if (t.includes("change")) return { path: "/change-checker", say: "Opening Change Checker." };
  if (t.includes("cash") || t.includes("money") || t.includes("scan")) return { path: "/cash-assistant", say: "Opening Cash Assistant." };
  return null;
}

export const Header = () => {
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);
  const supported = isSpeechRecognitionSupported();

  const handleVoice = () => {
    if (!supported) {
      speak("Voice control is not available in this browser. Please use the buttons.");
      return;
    }
    speak("Listening. Say check my bill, scan cash, check my change, or go home.");
    setTimeout(() => {
      listenOnce({
        onStart: () => setListening(true),
        onEnd: () => setListening(false),
        onError: (err) => {
          setListening(false);
          if (err === "not-allowed" || err === "service-not-allowed")
            speak("Microphone permission is needed for voice control. Please allow it and try again.");
          else speak("I did not catch that. Please try again or use the buttons.");
        },
        onResult: (transcript) => {
          const match = routeFor(transcript);
          if (match) { speak(match.say); navigate(match.path); }
          else speak(`I heard ${transcript}. Please say bill, cash, change, or home.`);
        },
      });
    }, 1400);
  };

  return (
    <header className="fixed top-0 left-0 w-full h-24 border-b-4 border-white bg-black z-50 flex items-center justify-between px-4 sm:px-6" data-testid="app-header">
      <button onClick={() => navigate("/")} aria-label="LIVO, go to home" data-testid="logo-home-btn"
        className="flex items-baseline gap-2 focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black rounded-sm">
        <span className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-white">LIVO</span>
        <span className="hidden sm:inline-block h-3 w-3 bg-primary" aria-hidden="true" />
      </button>

      <button onClick={handleVoice} aria-label="Voice assistance. Tap and speak a command." data-testid="voice-assist-btn"
        className={`flex items-center gap-3 h-16 px-4 sm:px-6 border-4 font-heading font-bold uppercase tracking-wide text-lg sm:text-xl shadow-[4px_4px_0px_0px_#FFFFFF] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-transform duration-75 focus:outline-none focus:ring-4 focus:ring-white focus:ring-offset-2 focus:ring-offset-black ${listening ? "bg-white text-black border-white animate-pulse" : "bg-primary text-black border-primary"}`}>
        {listening ? <Loader2 size={32} strokeWidth={3} className="animate-spin" aria-hidden="true" /> : <Mic size={32} strokeWidth={3} aria-hidden="true" />}
        <span className="hidden sm:inline">{listening ? "Listening" : "Voice"}</span>
      </button>
    </header>
  );
};

export default Header;
