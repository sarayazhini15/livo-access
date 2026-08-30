import { useNavigate } from "react-router-dom";
import { Mic, Radio, MicOff } from "lucide-react";
import { useVoice } from "@/context/VoiceContext";

export const Header = () => {
  const navigate = useNavigate();
  const { handsFree, status, supported, toggleHandsFree } = useVoice();

  const label = !supported ? "Voice N/A" : handsFree ? (status === "working" ? "Working" : "Listening") : "Voice";

  return (
    <header className="fixed top-0 left-0 w-full h-24 border-b-4 border-white bg-black z-50 flex items-center justify-between px-4 sm:px-6" data-testid="app-header">
      <button onClick={() => navigate("/")} aria-label="LIVO, go to home" data-testid="logo-home-btn"
        className="flex items-baseline gap-2 focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black rounded-sm">
        <span className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-white">LIVO</span>
        <span className="hidden sm:inline-block h-3 w-3 bg-primary" aria-hidden="true" />
      </button>

      <div className="flex flex-col items-end gap-1">
        <button onClick={toggleHandsFree}
          aria-label={supported ? (handsFree ? "Turn off voice assistant" : "Turn on voice assistant and speak a command") : "Voice control not supported. Please use the on screen buttons."}
          aria-pressed={handsFree}
          data-testid="voice-assist-btn"
          className={`flex items-center gap-3 h-16 px-4 sm:px-6 border-4 font-heading font-bold uppercase tracking-wide text-lg sm:text-xl shadow-[4px_4px_0px_0px_#FFFFFF] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-transform duration-75 focus:outline-none focus:ring-4 focus:ring-white focus:ring-offset-2 focus:ring-offset-black ${!supported ? "bg-black text-white border-white" : handsFree ? "bg-white text-black border-white animate-pulse" : "bg-primary text-black border-primary"}`}>
          {!supported ? <MicOff size={32} strokeWidth={3} aria-hidden="true" /> : handsFree ? <Radio size={32} strokeWidth={3} aria-hidden="true" /> : <Mic size={32} strokeWidth={3} aria-hidden="true" />}
          <span className="hidden sm:inline">{label}</span>
        </button>
        {!supported && (
          <span data-testid="voice-unsupported-note" className="text-xs font-bold uppercase tracking-wide text-primary max-w-[160px] text-right leading-tight">
            Voice not supported. Use the buttons.
          </span>
        )}
      </div>
    </header>
  );
};

export default Header;
