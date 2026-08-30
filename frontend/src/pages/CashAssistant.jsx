import { useRef, useState, useCallback, useEffect } from "react";
import { ScanLine, Banknote, Volume2, Loader2, AlertTriangle } from "lucide-react";
import ActionButton from "@/components/ActionButton";
import PlaceholderBlock from "@/components/PlaceholderBlock";
import CameraCapture from "@/components/CameraCapture";
import { scanCash } from "@/lib/api";
import { fileToResizedBase64 } from "@/lib/image";
import { speak } from "@/lib/speech";
import { useVoice } from "@/context/VoiceContext";

const rupees = (n) => `₹${Number(n || 0).toFixed(2)}`;

function fullSpeech(r) {
  if (!r.detected || !r.notes?.length) return "No currency notes were detected. Please try again with a clearer photo.";
  const parts = ["Detected notes."];
  r.notes.forEach((n) => parts.push(`${n.count} note${n.count > 1 ? "s" : ""} of ${rupees(n.denomination)}.`));
  parts.push(`Total cash is ${rupees(r.total)}.`);
  return parts.join(" ");
}
function voiceSummary(r) {
  if (!r.detected || !r.notes?.length) return "No notes detected. Please try again with a clearer photo.";
  const count = r.notes.reduce((a, n) => a + n.count, 0);
  return `I detected ${count} note${count > 1 ? "s" : ""}. Your total cash is ${rupees(r.total)}.`;
}

export default function CashAssistant() {
  const uploadRef = useRef(null);
  const uploadResolverRef = useRef(null);
  const pendingRef = useRef(null);
  const [camOpen, setCamOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState("");
  const { registerActions } = useVoice();

  const runAnalysis = useCallback(async (img) => {
    setError(""); setResult(null); setLoading(true);
    try {
      const data = await scanCash(img.base64, img.mimeType);
      setResult(data); setLoading(false); return data;
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Something went wrong while scanning the cash.";
      setError(msg); setLoading(false); return null;
    }
  }, []);

  const handleImage = useCallback(async (img, opts = {}) => {
    setPreview(img.dataUrl); pendingRef.current = img; setResult(null); setError("");
    if (opts.analyze !== false) {
      const data = await runAnalysis(img);
      if (data) speak(fullSpeech(data)); else speak("Sorry, I could not scan the cash. Please try again.");
    }
  }, [runAnalysis]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const voiceResolve = uploadResolverRef.current; uploadResolverRef.current = null;
    if (!file) { voiceResolve && voiceResolve(false); return; }
    try {
      const img = await fileToResizedBase64(file);
      await handleImage(img, { analyze: !voiceResolve });
      voiceResolve && voiceResolve(true);
    } catch (err) {
      setError(err.message); voiceResolve ? voiceResolve(false) : speak(`Sorry. ${err.message}`);
    }
  };

  useEffect(() => {
    return registerActions({
      openCamera: () => setCamOpen(true),
      closeCamera: () => setCamOpen(false),
      uploadImage: () => new Promise((resolve) => {
        uploadResolverRef.current = resolve;
        uploadRef.current?.click();
        setTimeout(() => { if (uploadResolverRef.current) { const r = uploadResolverRef.current; uploadResolverRef.current = null; r(false); } }, 60000);
      }),
      analyzePending: async () => {
        if (!pendingRef.current) return null;
        const data = await runAnalysis(pendingRef.current);
        return data ? voiceSummary(data) : "Sorry, I could not scan the cash. Please try again.";
      },
      replay: () => result && speak(fullSpeech(result)),
    });
  }, [registerActions, runAnalysis, result]);

  return (
    <div className="space-y-8" data-testid="cash-assistant-screen">
      <header className="space-y-2">
        <p className="text-lg font-bold uppercase tracking-widest text-primary">Module</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-white">Cash Assistant</h1>
      </header>

      <input ref={uploadRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" data-testid="cash-upload-input" />
      <CameraCapture open={camOpen} onClose={() => setCamOpen(false)} onCapture={handleImage} title="Cash Camera" hint="Lay the notes flat inside the frame" />

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

      <ActionButton icon={ScanLine} label="Scan Cash" testid="cash-scan-btn" variant="primary" onClick={() => setCamOpen(true)} />

      <section aria-label="Detected notes and total" className="space-y-4" aria-live="polite">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-white">Detected Notes</h2>
          {result?.detected && (
            <button onClick={() => speak(fullSpeech(result))} data-testid="cash-replay-btn" aria-label="Read result aloud again"
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
