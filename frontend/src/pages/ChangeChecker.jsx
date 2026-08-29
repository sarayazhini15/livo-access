import { useState, useCallback, useEffect } from "react";
import { ScanLine, Coins, Volume2, Loader2, AlertTriangle, CheckCircle2, Mic } from "lucide-react";
import ActionButton from "@/components/ActionButton";
import CameraCapture from "@/components/CameraCapture";
import { scanCash } from "@/lib/api";
import { speak, listenOnce, isSpeechRecognitionSupported } from "@/lib/speech";
import { useVoice } from "@/context/VoiceContext";

const rupees = (n) => `₹${Number(n || 0).toFixed(2)}`;

function parseAmount(text) {
  if (!text) return null;
  const m = text.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function AmountField({ label, value, onChange, testid }) {
  const [listening, setListening] = useState(false);
  const supported = isSpeechRecognitionSupported();

  const startVoice = () => {
    speak(`Say the ${label}.`);
    setTimeout(() => {
      listenOnce({
        onStart: () => setListening(true),
        onEnd: () => setListening(false),
        onError: () => { setListening(false); speak("I did not catch that. Please type the amount."); },
        onResult: (t) => {
          const amt = parseAmount(t);
          if (amt != null) { onChange(String(amt)); speak(`${label} set to ${amt} rupees.`); }
          else speak("I did not catch a number. Please type the amount.");
        },
      });
    }, 700);
  };

  return (
    <div className="space-y-2">
      <label className="block text-lg font-bold uppercase tracking-widest text-primary">{label}</label>
      <div className="flex items-stretch gap-3">
        <div className="flex items-center flex-1 border-4 border-white bg-[#111111]">
          <span className="px-4 font-heading text-2xl sm:text-3xl font-black text-primary">₹</span>
          <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" data-testid={testid}
            className="w-full bg-transparent text-white font-heading text-2xl sm:text-3xl font-bold py-4 pr-4 outline-none focus:ring-4 focus:ring-primary" />
        </div>
        {supported && (
          <button onClick={startVoice} data-testid={`${testid}-mic`} aria-label={`Say the ${label}`}
            className={`w-16 shrink-0 flex items-center justify-center border-4 transition-colors duration-75 focus:outline-none focus:ring-4 focus:ring-primary ${listening ? "bg-primary text-black border-primary animate-pulse" : "bg-black text-primary border-white"}`}>
            <Mic size={32} strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function ChangeChecker() {
  const [camOpen, setCamOpen] = useState(false);
  const [bill, setBill] = useState("");
  const [tendered, setTendered] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [received, setReceived] = useState(null);
  const { handsFree, registerActions, deliverResult } = useVoice();

  const billNum = parseFloat(bill) || 0;
  const tenderedNum = parseFloat(tendered) || 0;
  const expected = Math.max(0, +(tenderedNum - billNum).toFixed(2));
  const receivedTotal = received?.total || 0;

  let verdict = null;
  if (received?.detected) {
    const diff = +(receivedTotal - expected).toFixed(2);
    if (Math.abs(diff) < 0.5) verdict = { type: "correct", text: "Change is correct", speech: "Change is correct." };
    else if (diff < 0) verdict = { type: "short", text: `You are short by ${rupees(Math.abs(diff))}`, speech: `You are short by ${Math.abs(diff)} rupees.` };
    else verdict = { type: "extra", text: `You received ${rupees(diff)} extra`, speech: `You received ${diff} rupees extra.` };
  }

  const processImage = useCallback(async (img) => {
    if (tenderedNum <= 0 || billNum <= 0) {
      const msg = "Please enter the bill amount and the cash you handed over first.";
      setError(msg);
      if (handsFree) deliverResult(msg); else speak(msg);
      return msg;
    }
    setError(""); setReceived(null); setLoading(true);
    if (!handsFree) speak("Scanning the change you received. Please wait.");
    try {
      const data = await scanCash(img.base64, img.mimeType);
      setReceived(data); setLoading(false);
      const exp = Math.max(0, +(tenderedNum - billNum).toFixed(2));
      const diff = +((data.total || 0) - exp).toFixed(2);
      let spoken = `Expected change is ${exp} rupees. You received ${data.total || 0} rupees. `;
      if (!data.detected) spoken = "No notes detected in the change. Please try again with a clearer photo.";
      else if (Math.abs(diff) < 0.5) spoken += "Change is correct.";
      else if (diff < 0) spoken += `You are short by ${Math.abs(diff)} rupees.`;
      else spoken += `You received ${diff} rupees extra.`;
      if (handsFree) deliverResult(spoken); else speak(spoken);
      return spoken;
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Something went wrong while scanning the change.";
      setError(msg); setLoading(false);
      const spoken = `Sorry. ${msg}`;
      if (handsFree) deliverResult(spoken); else speak(spoken);
      return spoken;
    }
  }, [billNum, tenderedNum, handsFree, deliverResult]);

  useEffect(() => {
    return registerActions({
      openCamera: () => setCamOpen(true),
      closeCamera: () => setCamOpen(false),
      setBillAmount: (n) => setBill(String(n)),
      setTendered: (n) => setTendered(String(n)),
      replay: () => verdict && speak(`Expected change is ${expected} rupees. You received ${receivedTotal} rupees. ${verdict.speech}`),
    });
  }, [registerActions, verdict, expected, receivedTotal]);

  const replay = () => verdict && speak(`Expected change is ${expected} rupees. You received ${receivedTotal} rupees. ${verdict.speech}`);

  const openScan = () => {
    if (billNum <= 0 || tenderedNum <= 0) {
      const msg = "Please enter the bill amount and the cash you handed over first.";
      setError(msg); speak(msg); return;
    }
    setError("");
    setCamOpen(true);
  };

  return (
    <div className="space-y-8" data-testid="change-checker-screen">
      <header className="space-y-2">
        <p className="text-lg font-bold uppercase tracking-widest text-primary">Module</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-white">Change Checker</h1>
      </header>

      <CameraCapture open={camOpen} onClose={() => setCamOpen(false)} onCapture={processImage} title="Change Camera" hint="Lay the change notes flat inside the frame" />

      <div className="flex items-start gap-4 border-4 border-white bg-[#111111] p-6">
        <Coins size={48} strokeWidth={2} className="text-primary shrink-0" aria-hidden="true" />
        <p className="text-lg sm:text-xl text-white leading-relaxed">
          Enter your <span className="text-primary font-bold">bill amount</span> and the <span className="text-primary font-bold">cash you handed over</span>, then scan the change you received.
        </p>
      </div>

      <div className="space-y-5">
        <AmountField label="Bill amount" value={bill} onChange={setBill} testid="change-bill-input" />
        <AmountField label="Cash you handed over" value={tendered} onChange={setTendered} testid="change-tendered-input" />
      </div>

      <section aria-label="Change comparison" className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div data-testid="expected-change-area" className="border-4 border-white bg-[#111111] p-6 min-h-[140px] flex flex-col justify-between">
          <span className="text-lg font-bold uppercase tracking-widest text-primary">Expected Change</span>
          <span className="font-heading text-3xl sm:text-4xl font-black text-white mt-4">{tenderedNum > 0 && billNum > 0 ? rupees(expected) : "—"}</span>
        </div>
        <div data-testid="received-change-area" className="border-4 border-white bg-[#111111] p-6 min-h-[140px] flex flex-col justify-between">
          <span className="text-lg font-bold uppercase tracking-widest text-primary">Received Change</span>
          <span className="font-heading text-3xl sm:text-4xl font-black text-white mt-4">{received?.detected ? rupees(receivedTotal) : "—"}</span>
        </div>
      </section>

      <ActionButton icon={ScanLine} label="Scan Received Change" testid="change-scan-btn" variant="primary" onClick={openScan} />

      <div aria-live="polite" className="space-y-4">
        {loading && (
          <div data-testid="change-loading" className="w-full min-h-[120px] border-4 border-primary bg-[#111111] flex flex-col items-center justify-center gap-4 p-6">
            <Loader2 size={56} className="text-primary animate-spin" aria-hidden="true" />
            <p className="text-xl sm:text-2xl font-bold text-white">Scanning the change…</p>
          </div>
        )}

        {error && !loading && (
          <div data-testid="change-error" className="w-full border-4 border-white bg-[#111111] p-6 flex items-start gap-4">
            <AlertTriangle size={44} strokeWidth={2.5} className="text-primary shrink-0" aria-hidden="true" />
            <p className="text-xl sm:text-2xl font-bold text-white">{error}</p>
          </div>
        )}

        {!loading && !error && !verdict && (
          <div data-testid="change-result-area" className="border-4 border-dashed border-primary bg-[#111111] p-6 text-center">
            <p className="text-xl sm:text-2xl font-bold text-white">The comparison result will appear here.</p>
          </div>
        )}

        {verdict && !loading && (
          <div className="space-y-3" data-testid="change-result">
            <div data-testid="change-verdict" className={`flex items-center gap-4 border-4 p-5 ${verdict.type === "correct" ? "bg-primary text-black border-primary" : "bg-white text-black border-white"}`}>
              {verdict.type === "correct" ? <CheckCircle2 size={48} strokeWidth={2.5} aria-hidden="true" /> : <AlertTriangle size={48} strokeWidth={2.5} aria-hidden="true" />}
              <span className="font-heading text-2xl sm:text-3xl font-black uppercase tracking-wide">{verdict.text}</span>
            </div>
            {received?.detected && (
              <div className="border-4 border-white bg-[#111111] divide-y-4 divide-white" data-testid="change-received-notes">
                {received.notes.map((n, i) => (
                  <div key={i} className="flex items-center justify-between p-4">
                    <span className="text-lg sm:text-xl font-bold text-white">{rupees(n.denomination)} × {n.count}</span>
                    <span className="text-lg sm:text-xl font-bold text-primary">{rupees(n.subtotal)}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={replay} data-testid="change-replay-btn" aria-label="Read result aloud again"
              className="flex items-center gap-2 bg-primary text-black border-4 border-primary px-4 h-14 font-heading font-bold uppercase active:translate-x-[3px] active:translate-y-[3px] transition-transform duration-75 focus:outline-none focus:ring-4 focus:ring-white focus:ring-offset-2 focus:ring-offset-black">
              <Volume2 size={28} strokeWidth={2.5} aria-hidden="true" /> Replay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
