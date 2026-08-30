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

// After a SUCCESSFUL voice analysis, offer to move to the next module (voice yes/no).
const TRANSITIONS = {
  bill: { ask: "Bill verified. Can we move to Cash?", nextPath: "/cash-assistant", opened: "Cash scanner opened." },
  cash: { ask: "Cash verified. Can we move to Change?", nextPath: "/change-checker", opened: "Change checker opened." },
};
const YES_RE = /\b(yes|yeah|yep|yup|sure|ok|okay|move|proceed|continue|go ahead|please|do)\b/;
const NO_RE = /\b(no|nope|nah|stay|cancel|don'?t|do not|not now)\b/;

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
    if (key === "change") {
      // navigate to the real Change Scanner screen and confirm only after it actually opens
      navRef.current(PATH_FOR.change);
      const opened = await waitFor(() => pathRef.current === PATH_FOR.change, 2500);
      if (opened) await speakAsync("Change scanner opened.");
      else await speakAsync("I couldn't open the change scanner. Please try again.");
      return;
    }
    navRef.current(PATH_FOR[key]);
    await wait(150);
    const info = moduleInfo(PATH_FOR[key]);
    if (key === "cash") {
      // open the actual Cash Scanner camera interface, same as pressing the button
      await wait(250);
      await waitFor(() => !!actionsRef.current.openCamera, 3000);
      actionsRef.current.openCamera && actionsRef.current.openCamera();
      await speakAsync("Cash scanner opened.");
      return;
    }
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
      await speakAsync(`Camera access is unavailable. Please upload a ${mod.noun} image.`);
      return;
    }
    setStatus("working");
    const res = await actionsRef.current.captureNow();
    setStatus("listening");
    const ok = res && (res === true || res.ok);
    const reason = res && res.reason;
    if (ok) await speakAsync(`${cap(mod.noun)} captured successfully. Say analyze to read it.`);
    else if (reason === "no-camera") await speakAsync(`Camera access is unavailable. Please upload a ${mod.noun} image.`);
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

  const askTransition = useCallback(async (trans) => {
    await speakAsync(trans.ask);
    for (let i = 0; i < 2; i++) {
      const t = await listenOnceAsync();
      if (t != null) {
        const s = t.toLowerCase();
        if (YES_RE.test(s)) {
          navRef.current(trans.nextPath);
          await wait(150);
          await speakAsync(trans.opened);
          return true;
        }
        if (NO_RE.test(s)) {
          await speakAsync("Okay. Thank you for using LIVO.");
          return false;
        }
      }
      await speakAsync("Please say yes or no.");
    }
    return true;
  }, [speakAsync, listenOnceAsync]);

  const doAnalyze = useCallback(async () => {
    const mod = moduleInfo(pathRef.current);
    if (!mod) { await speakAsync("Please open a scanner first. Say open bill, open cash, or open change."); return true; }
    const a = actionsRef.current;
    if (!a.analyzePending) { await speakAsync("There is nothing to analyze here."); return true; }
    await speakAsync(`Analyzing your ${mod.noun}.`);
    setStatus("working");
    let res = null;
    try { res = await a.analyzePending(); } catch (e) { res = null; }
    setStatus("listening");
    if (!res || !res.summary) { await speakAsync("Please capture or upload an image first."); return true; }
    await speakAsync(res.summary);
    const trans = TRANSITIONS[mod.key];
    if (res.ok && trans) return await askTransition(trans);
    await speakAsync("What next?");
    return true;
  }, [speakAsync, askTransition]);

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

    // explicit cash / change scanner open commands (priority over generic capture)
    if (/\b(cash)\b/.test(s) && /\b(scan|open)\b/.test(s)) { await doOpen("cash", s); return true; }
    if (/\b(change)\b/.test(s) && /\b(scan|open)\b/.test(s)) { await doOpen("change", s); return true; }

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
      return await doAnalyze();
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
