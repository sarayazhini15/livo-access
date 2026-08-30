import { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { isTTSSupported, getSpeechRecognition, isSpeechRecognitionSupported } from "@/lib/speech";

const VoiceContext = createContext(null);
export const useVoice = () => useContext(VoiceContext);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred, timeout = 5000, interval = 150) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (pred()) return true;
    await wait(interval);
  }
  return pred();
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function moduleInfo(path) {
  if (path === "/bill-checker") return { key: "bill", noun: "bill", module: "Bill checker", scanner: "Bill scanner" };
  if (path === "/cash-assistant") return { key: "cash", noun: "cash", module: "Cash assistant", scanner: "Cash scanner" };
  if (path === "/change-checker") return { key: "change", noun: "change", module: "Change checker", scanner: "Change scanner" };
  return null;
}

const PATH_FOR = { bill: "/bill-checker", cash: "/cash-assistant", change: "/change-checker" };

export function VoiceProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(navigate);
  const pathRef = useRef(location.pathname);
  navRef.current = navigate;
  pathRef.current = location.pathname;

  const [handsFree, setHandsFree] = useState(false);
  const [supported] = useState(isSpeechRecognitionSupported());
  const [status, setStatus] = useState("idle"); // idle | listening | working
  const handsFreeRef = useRef(false);
  const actionsRef = useRef({});
  const recognitionRef = useRef(null);

  const registerActions = useCallback((obj) => {
    Object.assign(actionsRef.current, obj);
    return () => {
      Object.keys(obj).forEach((k) => { if (actionsRef.current[k] === obj[k]) delete actionsRef.current[k]; });
    };
  }, []);

  const speakAsync = useCallback((text) => {
    return new Promise((resolve) => {
      if (!isTTSSupported() || !text) return resolve();
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-IN"; u.rate = 1;
        let done = false;
        const fin = () => { if (!done) { done = true; resolve(); } };
        u.onend = fin; u.onerror = fin;
        setTimeout(fin, Math.min(16000, 2500 + text.length * 70));
        window.speechSynthesis.speak(u);
      } catch (e) { resolve(); }
    });
  }, []);

  const listenOnceAsync = useCallback(() => {
    return new Promise((resolve) => {
      const SR = getSpeechRecognition();
      if (!SR) return resolve(null);
      const rec = new SR();
      rec.lang = "en-IN"; rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
      recognitionRef.current = rec;
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; recognitionRef.current = null; resolve(v); } };
      rec.onresult = (e) => done(e.results[0][0].transcript);
      rec.onerror = () => done(null);
      rec.onend = () => done(null);
      try { rec.start(); } catch (e) { done(null); }
      setTimeout(() => { try { rec.stop(); } catch (e) {} done(null); }, 12000);
    });
  }, []);

  // --- command handling ---
  const doOpen = useCallback(async (key, phrase) => {
    navRef.current(PATH_FOR[key]);
    await wait(150);
    const info = moduleInfo(PATH_FOR[key]);
    if (/\bgo to\b/.test(phrase)) await speakAsync(`${info.module} opened.`);
    else await speakAsync(`${info.scanner} opened.`);
  }, [speakAsync]);

  const doCapture = useCallback(async () => {
    const mod = moduleInfo(pathRef.current);
    if (!mod) { await speakAsync("Please open a scanner first. Say open bill, open cash, or open change."); return; }
    const a = actionsRef.current;
    if (!a.captureNow) {
      a.openCamera && a.openCamera();
      await waitFor(() => !!actionsRef.current.captureNow, 6000);
    }
    if (!actionsRef.current.captureNow) {
      await speakAsync("The camera could not start. Say upload to choose a photo instead.");
      return;
    }
    setStatus("working");
    const ok = await actionsRef.current.captureNow();
    setStatus("listening");
    if (ok) await speakAsync(`${cap(mod.noun)} captured successfully. Say analyze to read it.`);
    else await speakAsync("I could not capture a clear photo. Say upload to choose one instead.");
  }, [speakAsync]);

  const doUpload = useCallback(async () => {
    const mod = moduleInfo(pathRef.current);
    if (!mod) { await speakAsync("Please open a scanner first. Say open bill, open cash, or open change."); return; }
    const a = actionsRef.current;
    if (!a.uploadImage) { await speakAsync("Upload is not available here."); return; }
    await speakAsync("Opening the file picker. Please choose an image.");
    setStatus("working");
    const ok = await a.uploadImage();
    setStatus("listening");
    if (ok) await speakAsync("Image uploaded successfully. Say analyze to read it.");
    else await speakAsync("No image was selected.");
  }, [speakAsync]);

  const doAnalyze = useCallback(async () => {
    const mod = moduleInfo(pathRef.current);
    if (!mod) { await speakAsync("Please open a scanner first. Say open bill, open cash, or open change."); return; }
    const a = actionsRef.current;
    if (!a.analyzePending) { await speakAsync("There is nothing to analyze here."); return; }
    await speakAsync(`Analyzing your ${mod.noun}.`);
    setStatus("working");
    let summary = null;
    try { summary = await a.analyzePending(); } catch (e) { summary = null; }
    setStatus("listening");
    if (summary) await speakAsync(summary);
    else await speakAsync("Please capture or upload an image first.");
  }, [speakAsync]);

  const handleCommand = useCallback(async (transcript) => {
    const s = transcript.toLowerCase().trim();
    const a = actionsRef.current;

    if (/\b(stop|exit|quit|turn off|goodbye|bye|cancel voice)\b/.test(s)) {
      await speakAsync("Voice assistant off."); return false;
    }
    if (/\b(go back|^back$|\bback\b|previous)\b/.test(s) && !/\bbill|cash|change|home\b/.test(s)) {
      navRef.current(-1); await speakAsync("Going back."); return true;
    }
    if (/\b(home|main menu|main screen)\b/.test(s)) {
      navRef.current("/"); await speakAsync("Home opened."); return true;
    }

    // capture
    if (/\b(capture|take a photo|take photo|scan now|snap|shoot|take picture)\b/.test(s)) {
      await doCapture(); await speakAsync("What next?"); return true;
    }
    // upload
    if (/\b(upload|choose photo|choose file|pick a photo|pick photo|select image|select a photo)\b/.test(s)) {
      await doUpload(); await speakAsync("What next?"); return true;
    }
    // analyze
    if (/\b(analyze|analyse|check this|check it|read this|read it|read the bill|check the bill)\b/.test(s)) {
      await doAnalyze(); await speakAsync("What next?"); return true;
    }
    // repeat
    if (/\b(repeat|read again|say again|replay)\b/.test(s)) {
      if (a.replay) a.replay(); else await speakAsync("There is no result to repeat yet.");
      return true;
    }

    // open / go to scanner
    const wantsOpen = /\b(open|go to|switch to|start)\b/.test(s);
    let target = null;
    if (/\b(bill|receipt|invoice)\b/.test(s)) target = "bill";
    else if (/\b(cash|money|notes|currency)\b/.test(s)) target = "cash";
    else if (/\b(change)\b/.test(s)) target = "change";

    if (target) { await doOpen(target, s); return true; }
    if (wantsOpen && !target) {
      await speakAsync("Which scanner would you like to open: bill, cash, or change?");
      return true;
    }

    await speakAsync(`I did not understand ${transcript}. You can say open bill, open cash, open change, capture, upload, analyze, go home, or go back.`);
    return true;
  }, [doCapture, doUpload, doAnalyze, doOpen, speakAsync]);

  const runLoop = useCallback(async () => {
    await speakAsync("Voice assistant ready. Say open bill, open cash, open change, or go home. Say stop to exit.");
    while (handsFreeRef.current) {
      setStatus("listening");
      await wait(200);
      if (!handsFreeRef.current) break;
      const t = await listenOnceAsync();
      if (!handsFreeRef.current) break;
      if (t == null) { await speakAsync("I did not hear you. Please speak after I finish talking."); continue; }
      const cont = await handleCommand(t);
      if (!cont) break;
    }
    handsFreeRef.current = false;
    setHandsFree(false);
    setStatus("idle");
  }, [handleCommand, listenOnceAsync, speakAsync]);

  const startHandsFree = useCallback(() => {
    if (handsFreeRef.current) return;
    if (!isSpeechRecognitionSupported()) {
      speakAsync("Voice control is not supported in this browser. Please use the on screen buttons.");
      return;
    }
    handsFreeRef.current = true;
    setHandsFree(true);
    runLoop();
  }, [runLoop, speakAsync]);

  const stopHandsFree = useCallback(() => {
    handsFreeRef.current = false;
    setHandsFree(false);
    setStatus("idle");
    try { recognitionRef.current?.stop(); } catch (e) {}
    if (isTTSSupported()) window.speechSynthesis.cancel();
  }, []);

  const toggleHandsFree = useCallback(() => {
    if (handsFreeRef.current) stopHandsFree(); else startHandsFree();
  }, [startHandsFree, stopHandsFree]);

  useEffect(() => () => stopHandsFree(), [stopHandsFree]);

  const value = { handsFree, status, supported, toggleHandsFree, startHandsFree, stopHandsFree, registerActions };
  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
