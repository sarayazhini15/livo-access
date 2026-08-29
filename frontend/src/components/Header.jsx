import { useNavigate } from "react-router-dom";
import { Mic } from "lucide-react";

export const Header = () => {
  const navigate = useNavigate();

  return (
    <header
      className="fixed top-0 left-0 w-full h-24 border-b-4 border-white bg-black z-50 flex items-center justify-between px-4 sm:px-6"
      data-testid="app-header"
    >
      <button
        onClick={() => navigate("/")}
        aria-label="LIVO, go to home"
        data-testid="logo-home-btn"
        className="flex items-baseline gap-2 focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black rounded-sm"
      >
        <span className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-white">
          LIVO
        </span>
        <span className="hidden sm:inline-block h-3 w-3 bg-primary" aria-hidden="true" />
      </button>

      <button
        aria-label="Voice assistance"
        data-testid="voice-assist-btn"
        className="flex items-center gap-3 bg-primary text-black h-16 px-4 sm:px-6 border-4 border-primary font-heading font-bold uppercase tracking-wide text-lg sm:text-xl shadow-[4px_4px_0px_0px_#FFFFFF] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-transform duration-75 focus:outline-none focus:ring-4 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
      >
        <Mic size={32} strokeWidth={3} aria-hidden="true" />
        <span className="hidden sm:inline">Voice</span>
      </button>
    </header>
  );
};

export default Header;
