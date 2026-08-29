import { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  isTTSSupported,
  getSpeechRecognition,
  isSpeechRecognitionSupported,
} from "@/lib/speech";

const VoiceContext = createContext(null);
export const useVoice = () => useContext(VoiceContext);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const waitValue = (ms, val) => new Promise((r) => setTimeout(() => r(val), ms));

function parseAmount(text) {
  const m = text.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export function VoiceProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(navigate);
  const pathRef = useRef(location.pathname);
  navRef.current = navigate;
  pathRef.current = location.pathname;

  const [handsFree, setHandsFree] = useState(false);
  const handsFreeRef = useRef(false);
  const actionsRef = useRef({});
  const recognitionRef = useRef(null);
  const resultResolverRef = useRef(null);

  // Pages register imperative actions (openCamera, closeCamera, replay, setBillAmount, setTendered, triggerCapture)
  const registerActions = useCallback((obj) => {
    Object.assign(actionsRef.current, obj);
    return () => {
      Object.keys(obj).forEach((k) => {
        if (actionsRef.current[k] === obj[k]) delete actionsRef.current[k];
      });
    };
  }, []);

  const awaitResult = useCallback(() => {
    return new Promise((res) => {
      resultResolverRef.current = res;
    });
  }, []);

  const deliverResult = useCallback((summary) => {
    if (resultResolverRef.current) {
      resultResolverRef.current(summary);
      resultResolverRef.current = null;
    }
  }, []);

  const speakAsync = useCallback((text) => {
    return new Promise((resolve) => {
      if (!isTTSSupported() || !text) return resolve();
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "en-IN";
        utter.rate = 1;
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        utter.onend = finish;
        utter.onerror = finish;
        // safety fallback in case onend never fires
        setTimeout(finish, Math.min(16000, 2500 + text.length * 70));
        window.speechSynthesis.speak(utter);
      } catch (e) {
        resolve();
      }
    });
  }, []);

  const listenOnceAsync = useCallback(() => {
    return new Promise((resolve) => {
      const SR = getSpeechRecognition();
      if (!SR) return resolve(null);
      const rec = new SR();
      rec.lang = "en-IN";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;
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

  const runScanFlow = useCallback(async () => {
    const a = actionsRef.current;
    if (!a.openCamera) {
      await speakAsync("There is nothing to scan here. Say bill, cash, or change.");
      return;
    }
    a.openCamera();
    await speakAsync("Camera opening. Hold the item steady inside the frame. Capturing in 3, 2, 1.");
    await wait(500);
    if (!a.triggerCapture) {
      await speakAsync("The camera is not ready yet. Please tap the capture button.");
      return;
    }
    const p = awaitResult();
    a.triggerCapture();
    await speakAsync("Captured. Reading now, please wait.");
    const summary = await Promise.race([p, waitValue(22000, null)]);
    if (summary) await speakAsync(summary);
    else await speakAsync("Sorry, that took too long. Please try again.");
  }, [awaitResult, speakAsync]);

  const handleCommand = useCallback(async (transcript) => {
    const s = transcript.toLowerCase();
    const path = pathRef.current;
    const a = actionsRef.current;

    if (/\b(stop|exit|quit|turn off|cancel voice|goodbye|bye)\b/.test(s)) {
      await speakAsync("Hands free mode off.");
      return false;
    }
    if (/\b(home|main menu|main screen|start)\b/.test(s)) {
      navRef.current("/");
      await speakAsync("Home. Say bill, cash, or change.");
      return true;
    }
    if (/\b(bill|receipt|invoice)\b/.test(s) && !/\b(bill is|bill amount|the bill)\b/.test(s)) {
      // navigation to bill checker (but on change page 'bill is X' sets amount below)
      if (path === "/change-checker" && /\d/.test(s)) {
        // fall through to amount parsing
      } else {
        navRef.current("/bill-checker");
        await speakAsync("Bill Checker. Say scan to open the camera, or tap upload bill.");
        return true;
      }
    }
    if (/\b(cash|money|notes|currency)\b/.test(s) && !/\d/.test(s)) {
      navRef.current("/cash-assistant");
      await speakAsync("Cash Assistant. Say scan to open the camera.");
      return true;
    }
    if (/\b(change)\b/.test(s) && !/\b(received|correct|scan)\b/.test(s)) {
      navRef.current("/change-checker");
      await speakAsync("Change Checker. Say the bill amount, for example, bill is 320. Then say paid, for example, paid 500. Then say scan.");
      return true;
    }

    // Change page amount entry
    if (path === "/change-checker") {
      const amt = parseAmount(s);
      if (amt != null && /\b(bill|total|owe|amount)\b/.test(s) && a.setBillAmount) {
        a.setBillAmount(amt);
        await speakAsync(`Bill amount set to ${amt} rupees.`);
        return true;
      }
      if (amt != null && /\b(paid|pay|gave|give|handed|tender|with)\b/.test(s) && a.setTendered) {
        a.setTendered(amt);
        await speakAsync(`Cash handed over set to ${amt} rupees.`);
        return true;
      }
    }

    if (/\b(scan|capture|take photo|photo|snap|shoot|check)\b/.test(s)) {
      await runScanFlow();
      await speakAsync("What next? Say bill, cash, change, or stop.");
      return true;
    }

    if (/\b(repeat|read|again|replay|say again)\b/.test(s)) {
      if (a.replay) { a.replay(); }
      else await speakAsync("There is no result to repeat yet.");
      return true;
    }

    await speakAsync(`I heard, ${transcript}. Say bill, cash, change, scan, home, or stop.`);
    return true;
  }, [runScanFlow, speakAsync]);

  const runLoop = useCallback(async () => {
    await speakAsync("Hands free mode on. Say bill, cash, change, or home. Say stop any time to exit.");
    while (handsFreeRef.current) {
      await wait(250);
      if (!handsFreeRef.current) break;
      const t = await listenOnceAsync();
      if (!handsFreeRef.current) break;
      if (t == null) {
        await speakAsync("I did not hear you. Please speak after I finish talking.");
        continue;
      }
      const cont = await handleCommand(t);
      if (!cont) break;
    }
    handsFreeRef.current = false;
    setHandsFree(false);
  }, [handleCommand, listenOnceAsync, speakAsync]);

  const startHandsFree = useCallback(() => {
    if (handsFreeRef.current) return;
    if (!isSpeechRecognitionSupported()) {
      speakAsync("Voice control is not available in this browser. Please use the buttons.");
      return;
    }
    handsFreeRef.current = true;
    setHandsFree(true);
    runLoop();
  }, [runLoop, speakAsync]);

  const stopHandsFree = useCallback(() => {
    handsFreeRef.current = false;
    setHandsFree(false);
    try { recognitionRef.current?.stop(); } catch (e) {}
    if (isTTSSupported()) window.speechSynthesis.cancel();
  }, []);

  const toggleHandsFree = useCallback(() => {
    if (handsFreeRef.current) stopHandsFree();
    else startHandsFree();
  }, [startHandsFree, stopHandsFree]);

  useEffect(() => () => stopHandsFree(), [stopHandsFree]);

  const value = {
    handsFree,
    toggleHandsFree,
    startHandsFree,
    stopHandsFree,
    registerActions,
    awaitResult,
    deliverResult,
  };

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
