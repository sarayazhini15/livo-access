import { useRef, useState } from "react";
import { ScanLine, Banknote, Volume2, Loader2, AlertTriangle } from "lucide-react";
import ActionButton from "@/components/ActionButton";
import PlaceholderBlock from "@/components/PlaceholderBlock";
import { scanCash } from "@/lib/api";
import { fileToResizedBase64 } from "@/lib/image";
import { speak } from "@/lib/speech";

const rupees = (n) => `₹${Number(n || 0).toFixed(2)}`;

function buildSpeech(r) {
  if (!r.detected || !r.notes?.length) {
    return "No currency notes were detected. Please try again with a clearer photo.";
  }
  const parts = ["Detected notes."];
  r.notes.forEach((n) => {
    parts.push(`${n.count} note${n.count > 1 ? "s" : ""} of ${rupees(n.denomination)}.`);
  });
  parts.push(`Total cash is ${rupees(r.total)}.`);
  return parts.join(" ");
}

export default function CashAssistant() {
  const cameraRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setResult(null);
    setLoading(true);
    speak("Scanning your cash. Please wait.");
    try {
      const { base64, mimeType, dataUrl } = await fileToResizedBase64(file);
      setPreview(dataUrl);
      const data = await scanCash(base64, mimeType);
      setResult(data);
      speak(buildSpeech(data));
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Something went wrong while scanning the cash.";
      setError(msg);
      speak(`Sorry. ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8" data-testid="cash-assistant-screen">
      <header className="space-y-2">
        <p className="text-lg font-bold uppercase tracking-widest text-primary">Module</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-white">Cash Assistant</h1>
      </header>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" data-testid="cash-camera-input" />

      {!preview ? (
        <PlaceholderBlock testid="cash-scan-area">
          <Banknote size={64} strokeWidth={2} className="text-primary mb-4" aria-hidden="true" />
          <p className="font-heading text-2xl sm:text-3xl font-bold text-white uppercase">Scan your cash</p>
          <p className="text-base sm:text-lg text-white mt-2">Hold your notes in front of the camera to identify them.</p>
        </PlaceholderBlock>
      ) : (
        <div className="w-full border-4 border-white bg-[#111111] p-3" data-testid="cash-preview">
          <img src={preview} alt="Scanned cash" className="w-full max-h-[320px] object-contain" />
        </div>
      )}

      <ActionButton icon={ScanLine} label="Scan Cash" testid="cash-scan-btn" variant="primary" onClick={() => cameraRef.current?.click()} />

      <section aria-label="Detected notes and total" className="space-y-4" aria-live="polite">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-white">Detected Notes</h2>
          {result?.detected && (
            <button onClick={() => speak(buildSpeech(result))} data-testid="cash-replay-btn" aria-label="Read result aloud again"
              className="flex items-center gap-2 bg-primary text-black border-4 border-primary px-4 h-14 font-heading font-bold uppercase active:translate-x-[3px] active:translate-y-[3px] transition-transform duration-75 focus:outline-none focus:ring-4 focus:ring-white focus:ring-offset-2 focus:ring-offset-black">
              <Volume2 size={28} strokeWidth={2.5} aria-hidden="true" /> Replay
            </button>
          )}
        </div>

        {loading && (
          <div data-testid="cash-loading" className="w-full min-h-[160px] border-4 border-primary bg-[#111111] flex flex-col items-center justify-center gap-4 p-6">
            <Loader2 size={56} className="text-primary animate-spin" aria-hidden="true" />
            <p className="text-xl sm:text-2xl font-bold text-white">Scanning your cash…</p>
          </div>
        )}

        {error && !loading && (
          <div data-testid="cash-error" className="w-full border-4 border-white bg-[#111111] p-6 flex items-start gap-4">
            <AlertTriangle size={44} strokeWidth={2.5} className="text-primary shrink-0" aria-hidden="true" />
            <p className="text-xl sm:text-2xl font-bold text-white">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div data-testid="cash-detected-area" className="border-4 border-white bg-[#111111] divide-y-4 divide-white">
              {result?.detected ? (
                result.notes.map((n, i) => (
                  <div key={i} className="flex items-center justify-between p-5">
                    <span className="text-xl sm:text-2xl font-bold text-white">{rupees(n.denomination)} note × {n.count}</span>
                    <span className="text-xl sm:text-2xl font-bold text-primary">{rupees(n.subtotal)}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between p-5">
                  <span className="text-xl sm:text-2xl font-bold text-white">{result ? "No notes detected" : "No notes scanned yet"}</span>
                  <span className="text-xl sm:text-2xl font-bold text-primary">—</span>
                </div>
              )}
            </div>
            <div data-testid="cash-total-area" className="flex items-center justify-between border-4 border-primary bg-primary text-black p-5">
              <span className="font-heading text-2xl sm:text-3xl font-black uppercase">Total</span>
              <span className="font-heading text-2xl sm:text-3xl font-black">{result?.detected ? rupees(result.total) : "—"}</span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
