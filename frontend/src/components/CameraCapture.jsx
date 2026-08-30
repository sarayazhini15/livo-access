import { useRef, useEffect, useState, useCallback } from "react";
import { Upload, X, Aperture } from "lucide-react";
import { fileToResizedBase64 } from "@/lib/image";
import { useVoice } from "@/context/VoiceContext";

// Live camera modal with a guide frame. Falls back to file upload if camera is unavailable.
// onCapture(img, opts) — opts.analyze defaults to true (tap). Voice capture passes { analyze: false }.
export default function CameraCapture({ open, onClose, onCapture, title = "Camera", hint = "Position inside the frame" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const uploadRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const voice = useVoice();

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setReady(false);
  }, []);

  const grabFrame = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return null;
    for (let i = 0; i < 25 && (!v.videoWidth || !v.videoHeight); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!v.videoWidth) return null;
    let w = v.videoWidth, h = v.videoHeight;
    const maxDim = 1600;
    if (w > maxDim || h > maxDim) {
      const scale = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * scale); h = Math.round(h * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(v, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    return { base64: dataUrl.split(",")[1], mimeType: "image/jpeg", dataUrl };
  }, []);

  // tap capture -> capture AND analyze (default)
  const tapCapture = useCallback(async () => {
    const img = await grabFrame();
    if (!img) { setError("Could not capture a clear photo. Please try again or upload instead."); return; }
    stop(); onClose?.(); onCapture?.(img);
  }, [grabFrame, stop, onClose, onCapture]);

  // voice capture -> capture ONLY, no analysis; returns success boolean
  const voiceCapture = useCallback(async () => {
    const img = await grabFrame();
    if (!img) { setError("Could not capture a clear photo. Please upload instead."); return false; }
    stop(); onClose?.(); onCapture?.(img, { analyze: false });
    return true;
  }, [grabFrame, stop, onClose, onCapture]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { const img = await fileToResizedBase64(file); stop(); onClose?.(); onCapture?.(img); }
    catch (err) { setError(err.message || "Could not read the image."); }
  };

  useEffect(() => {
    let cancelled = false;
    if (!open) return;
    setError(""); setReady(false);
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Live camera is not supported here. Please upload a photo instead."); return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (err) {
        setError("Camera permission was blocked. Please allow the camera or upload a photo instead.");
      }
    })();
    return () => { cancelled = true; stop(); };
  }, [open, stop]);

  // register voice capture trigger while the modal is open
  useEffect(() => {
    if (!open || !voice) return;
    return voice.registerActions({ captureNow: voiceCapture });
  }, [open, voice, voiceCapture]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" data-testid="camera-modal" role="dialog" aria-label={title}>
      <div className="flex items-center justify-between h-20 px-4 border-b-4 border-white shrink-0">
        <span className="font-heading text-2xl sm:text-3xl font-black text-white uppercase">{title}</span>
        <button onClick={() => { stop(); onClose?.(); }} data-testid="camera-close-btn" aria-label="Close camera"
          className="flex items-center gap-2 bg-white text-black border-4 border-white h-14 px-4 font-heading font-bold uppercase active:translate-x-[3px] active:translate-y-[3px] transition-transform duration-75 focus:outline-none focus:ring-4 focus:ring-primary">
          <X size={28} strokeWidth={3} aria-hidden="true" /> Close
        </button>
      </div>

      <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
        {!error ? (
          <>
            <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" data-testid="camera-video" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="w-full max-w-2xl aspect-[4/3] border-4 border-dashed border-primary" />
            </div>
            <div className="pointer-events-none absolute top-4 left-0 right-0 flex justify-center px-4">
              <span className="bg-black/80 text-white border-2 border-primary px-4 py-2 font-bold text-lg sm:text-xl text-center">{hint}</span>
            </div>
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white font-bold text-xl">Starting camera…</span>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center max-w-xl">
            <p className="text-xl sm:text-2xl font-bold text-white" data-testid="camera-error">{error}</p>
          </div>
        )}
      </div>

      <input ref={uploadRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" data-testid="camera-upload-input" />

      <div className="shrink-0 border-t-4 border-white p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!error && (
          <button onClick={tapCapture} data-testid="camera-capture-btn" aria-label="Capture photo"
            className="min-h-[80px] flex items-center justify-center gap-3 bg-primary text-black border-4 border-primary font-heading text-2xl sm:text-3xl font-bold uppercase shadow-[6px_6px_0px_0px_#FFFFFF] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-transform duration-75 focus:outline-none focus:ring-4 focus:ring-white focus:ring-offset-4 focus:ring-offset-black">
            <Aperture size={40} strokeWidth={2.5} aria-hidden="true" /> Capture
          </button>
        )}
        <button onClick={() => uploadRef.current?.click()} data-testid="camera-upload-btn" aria-label="Upload a photo instead"
          className={`min-h-[80px] flex items-center justify-center gap-3 bg-white text-black border-4 border-white font-heading text-2xl sm:text-3xl font-bold uppercase active:translate-x-[6px] active:translate-y-[6px] transition-transform duration-75 focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-4 focus:ring-offset-black ${error ? "sm:col-span-2" : ""}`}>
          <Upload size={40} strokeWidth={2.5} aria-hidden="true" /> Upload Instead
        </button>
      </div>
    </div>
  );
}
