import { useRef, useState, useCallback, useEffect } from "react";
import { Camera, Upload, ReceiptText, CheckCircle2, AlertTriangle, Volume2, Loader2 } from "lucide-react";
import ActionButton from "@/components/ActionButton";
import PlaceholderBlock from "@/components/PlaceholderBlock";
import CameraCapture from "@/components/CameraCapture";
import { analyzeBill } from "@/lib/api";
import { fileToResizedBase64 } from "@/lib/image";
import { speak } from "@/lib/speech";
import { useVoice } from "@/context/VoiceContext";

const rupees = (n) => `₹${Number(n || 0).toFixed(2)}`;

function reconSpeech(r) {
  const parts = [`Your items total ${rupees(r.subtotal)}.`];
  if (r.discount > 0) parts.push(`A discount of ${rupees(r.discount)} was applied.`);
  if (r.tax > 0) parts.push(`Tax of ${rupees(r.tax)} was added.`);
  if (r.delivery_charge > 0) parts.push(`Delivery charge of ${rupees(r.delivery_charge)}.`);
  if (r.service_charge > 0) parts.push(`Service charge of ${rupees(r.service_charge)}.`);
  if (r.other_adjustments && r.other_adjustments !== 0) parts.push(`An adjustment of ${rupees(Math.abs(r.other_adjustments))} was ${r.other_adjustments > 0 ? "added" : "applied"}.`);
  parts.push(`The final amount is ${rupees(r.total)}.`);
  if (r.verified) parts.push("The bill calculation matches.");
  else parts.push((r.issues && r.issues[0]) || "Please verify the bill.");
  return parts.join(" ");
}
function fullSpeech(r) {
  const parts = [`Bill from ${r.merchant}.`];
  if (r.date && r.date !== "Not found") parts.push(`Dated ${r.date}.`);
  (r.items || []).forEach((it) => parts.push(`${it.name}, ${it.quantity} at ${rupees(it.unit_price)} each, total ${rupees(it.line_total)}.`));
  parts.push(reconSpeech(r));
  return parts.join(" ");
}
function voiceSummary(r) {
  return reconSpeech(r);
}

export default function BillChecker() {
  const uploadRef = useRef(null);
  const uploadResolverRef = useRef(null);
  const pendingRef = useRef(null);
  const [camOpen, setCamOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState("");
  const { registerActions, setSharedBill } = useVoice();

  const runAnalysis = useCallback(async (img) => {
    setError(""); setResult(null); setLoading(true);
    try {
      const data = await analyzeBill(img.base64, img.mimeType);
      setResult(data); setLoading(false);
      if (data && setSharedBill && data.total) setSharedBill(data.total);
      return data;
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Something went wrong while reading the bill.";
      setError(msg); setLoading(false); return null;
    }
  }, [setSharedBill]);

  const handleImage = useCallback(async (img, opts = {}) => {
    setPreview(img.dataUrl); pendingRef.current = img; setResult(null); setError("");
    if (opts.analyze !== false) {
      const data = await runAnalysis(img);
      if (data) speak(fullSpeech(data)); else speak("Sorry, I could not read the bill. Please try again.");
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
        if (!data) return { summary: "Sorry, I could not read your bill. Please try again.", ok: false };
        return { summary: voiceSummary(data), ok: !!data.verified };
      },
      replay: () => result && speak(fullSpeech(result)),
    });
  }, [registerActions, runAnalysis, result]);

  return (
    <div className="space-y-8" data-testid="bill-checker-screen">
      <header className="space-y-2">
        <p className="text-lg font-bold uppercase tracking-widest text-primary">Module</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-white">Bill Checker</h1>
      </header>

      <input ref={uploadRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" data-testid="bill-upload-input" />
      <CameraCapture open={camOpen} onClose={() => setCamOpen(false)} onCapture={handleImage} title="Bill Camera" hint="Fit the whole bill inside the frame" />

      {!preview ? (
        <PlaceholderBlock testid="bill-capture-area">
          <ReceiptText size={64} strokeWidth={2} className="text-primary mb-4" aria-hidden="true" />
          <p className="font-heading text-2xl sm:text-3xl font-bold text-white uppercase">Upload or capture a bill</p>
          <p className="text-base sm:text-lg text-white mt-2">Take a photo or upload an image of your bill or receipt.</p>
        </PlaceholderBlock>
      ) : (
        <div className="w-full border-4 border-white bg-[#111111] p-3" data-testid="bill-preview">
          <img src={preview} alt="Selected bill" className="w-full max-h-[320px] object-contain" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <ActionButton icon={Camera} label="Take Photo" testid="bill-take-photo-btn" variant="primary" onClick={() => setCamOpen(true)} />
        <ActionButton icon={Upload} label="Upload Bill" testid="bill-upload-btn" variant="secondary" onClick={() => uploadRef.current?.click()} />
      </div>

      <section aria-label="Bill analysis result" className="space-y-4" aria-live="polite">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-white">Result</h2>
          {result && (
            <button onClick={() => speak(fullSpeech(result))} data-testid="bill-replay-btn" aria-label="Read result aloud again"
              className="flex items-center gap-2 bg-primary text-black border-4 border-primary px-4 h-14 font-heading font-bold uppercase active:translate-x-[3px] active:translate-y-[3px] transition-transform duration-75 focus:outline-none focus:ring-4 focus:ring-white focus:ring-offset-2 focus:ring-offset-black">
              <Volume2 size={28} strokeWidth={2.5} aria-hidden="true" /> Replay
            </button>
          )}
        </div>

        {loading && (
          <div data-testid="bill-loading" className="w-full min-h-[160px] border-4 border-primary bg-[#111111] flex flex-col items-center justify-center gap-4 p-6">
            <Loader2 size={56} className="text-primary animate-spin" aria-hidden="true" />
            <p className="text-xl sm:text-2xl font-bold text-white">Reading your bill…</p>
          </div>
        )}

        {error && !loading && (
          <div data-testid="bill-error" className="w-full border-4 border-white bg-[#111111] p-6 flex items-start gap-4">
            <AlertTriangle size={44} strokeWidth={2.5} className="text-primary shrink-0" aria-hidden="true" />
            <p className="text-xl sm:text-2xl font-bold text-white">{error}</p>
          </div>
        )}

        {!loading && !error && !result && (
          <div data-testid="bill-result-area" className="w-full min-h-[160px] border-4 border-white bg-[#111111] p-6 flex flex-col items-center justify-center text-center">
            <p className="text-xl sm:text-2xl font-bold text-white">Your bill details will appear here.</p>
            <p className="text-base sm:text-lg text-primary mt-2">Totals, taxes and items will be read out for you.</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4" data-testid="bill-result">
            <div data-testid="bill-status" className={`flex items-center gap-4 border-4 p-5 ${result.verified ? "bg-primary text-black border-primary" : "bg-white text-black border-white"}`}>
              {result.verified ? <CheckCircle2 size={48} strokeWidth={2.5} aria-hidden="true" /> : <AlertTriangle size={48} strokeWidth={2.5} aria-hidden="true" />}
              <span className="font-heading text-3xl sm:text-4xl font-black uppercase tracking-wide">{result.status}</span>
            </div>

            <div className="border-4 border-white bg-[#111111] p-5 space-y-1">
              <p className="text-lg sm:text-xl text-white"><span className="text-primary font-bold uppercase">Merchant: </span>{result.merchant}</p>
              <p className="text-lg sm:text-xl text-white"><span className="text-primary font-bold uppercase">Date: </span>{result.date}</p>
            </div>

            <div className="border-4 border-white bg-[#111111]">
              {(result.items || []).map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-4 border-b-2 border-white last:border-b-0">
                  <div className="flex-1">
                    <p className="text-lg sm:text-xl font-bold text-white">{it.name}</p>
                    <p className="text-base text-primary">{it.quantity} × {rupees(it.unit_price)}</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-white">{rupees(it.line_total)}</p>
                </div>
              ))}
            </div>

            <div className="border-4 border-white bg-[#111111] p-5 space-y-2">
              <div className="flex justify-between text-lg sm:text-xl text-white"><span>Subtotal</span><span className="font-bold">{rupees(result.subtotal)}</span></div>
              {result.discount > 0 && (
                <div className="flex justify-between text-lg sm:text-xl text-white"><span>Discount</span><span className="font-bold">- {rupees(result.discount)}</span></div>
              )}
              {result.tax > 0 && (
                <div className="flex justify-between text-lg sm:text-xl text-white"><span>Tax</span><span className="font-bold">{rupees(result.tax)}</span></div>
              )}
              {result.delivery_charge > 0 && (
                <div className="flex justify-between text-lg sm:text-xl text-white"><span>Delivery</span><span className="font-bold">{rupees(result.delivery_charge)}</span></div>
              )}
              {result.service_charge > 0 && (
                <div className="flex justify-between text-lg sm:text-xl text-white"><span>Service / Fees</span><span className="font-bold">{rupees(result.service_charge)}</span></div>
              )}
              {result.other_adjustments && result.other_adjustments !== 0 ? (
                <div className="flex justify-between text-lg sm:text-xl text-white"><span>Adjustment</span><span className="font-bold">{result.other_adjustments < 0 ? "- " : ""}{rupees(Math.abs(result.other_adjustments))}</span></div>
              ) : null}
              <div className="flex justify-between border-t-2 border-primary pt-2 font-heading text-2xl sm:text-3xl font-black text-primary"><span>TOTAL</span><span>{rupees(result.total)}</span></div>
            </div>

            {!result.verified && result.issues?.length > 0 && (
              <div data-testid="bill-issues" className="border-4 border-white bg-[#111111] p-5 space-y-3">
                <p className="font-heading text-xl sm:text-2xl font-extrabold text-primary uppercase">What is wrong</p>
                <ul className="space-y-2 list-none">
                  {result.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-3 text-lg sm:text-xl text-white">
                      <AlertTriangle size={26} strokeWidth={2.5} className="text-primary shrink-0 mt-1" aria-hidden="true" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
