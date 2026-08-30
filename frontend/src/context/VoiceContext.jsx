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
};
const YES_RE = /\b(yes|yeah|yep|yup|sure|ok|okay|move|proceed|continue|go ahead|please|do)\b/;
const NO_RE = /\b(no|nope|nah|stay|cancel|don'?t|do not|not now)\b/;
function parseAmount(text) {
  if (!text) return null;
  const m = text.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
// Extract bill and/or cash amounts from a single natural utterance.
function extractBillCash(text) {
  const s = (text || "").toLowerCase().replace(/,/g, "");
  const nums = (s.match(/\d+(\.\d+)?/g) || []).map(Number);
  let bill = null, cash = null;
  const billM = s.match(/bill[^0-9]*(\d+(\.\d+)?)/);
  const cashM = s.match(/(?:paid|pay|handed|hand over|handed over|cash|gave|give|tender)[^0-9]*(\d+(\.\d+)?)/);
  if (billM) bill = Number(billM[1]);
  if (cashM) cash = Number(cashM[1]);
  if (bill == null && cash == null) {
    if (nums.length >= 1) bill = nums[0];
    if (nums.length >= 2) cash = nums[1];
  } else {
    if (bill != null && cash == null && nums.length >= 2) { const o = nums.find((n) => n !== bill); if (o != null) cash = o; }
    if (cash != null && bill == null && nums.length >= 2) { const o = nums.find((n) => n !== cash); if (o != null) bill = o; }
  }
  return { bill, cash };
}

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
  const sharedRef = useRef({ billAmount: null, cashPaid: null, expectedChange: null, receivedChange: null });

  const setSharedBill = useCallback((n) => { sharedRef.current.billAmount = n; }, []);
  const setSharedCash = useCallback((n) => { sharedRef.current.cashPaid = n; }, []);
  const setSharedReceived = useCallback((n) => { sharedRef.current.receivedChange = n; }, []);

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

  const runChangeSetup = useCallback(async () => {
    let bill = sharedRef.current.billAmount;
    let cashp = sharedRef.current.cashPaid;
    if (bill != null && actionsRef.current.setBillAmount) actionsRef.current.setBillAmount(bill);
    if (cashp != null && actionsRef.current.setTendered) actionsRef.current.setTendered(cashp);

    // Ask for the bill amount (a single utterance may contain both values)
    if (bill == null) {
      let got = false;
      for (let i = 0; i < 2 && !got; i++) {
        await speakAsync(i === 0 ? "Tell me the bill amount." : "I couldn't understand the amount. Please say it again.");
        const t = await listenOnceAsync();
        if (t != null) {
          const ex = extractBillCash(t);
          if (ex.bill != null) { bill = ex.bill; if (ex.cash != null && cashp == null) cashp = ex.cash; got = true; }
        }
      }
      if (!got) { await speakAsync("I couldn't understand the amount. Please say it again, or type it."); return; }
      actionsRef.current.setBillAmount && actionsRef.current.setBillAmount(bill);
      sharedRef.current.billAmount = bill;
      if (cashp != null) { actionsRef.current.setTendered && actionsRef.current.setTendered(cashp); sharedRef.current.cashPaid = cashp; }
    }

    // Ask for the cash handed over
    if (cashp == null) {
      let got = false;
      for (let i = 0; i < 2 && !got; i++) {
        await speakAsync(i === 0 ? "Tell me the cash you handed over." : "I couldn't understand the amount. Please say it again.");
        const t = await listenOnceAsync();
        if (t != null) {
          const ex = extractBillCash(t);
          const val = ex.cash != null ? ex.cash : ex.bill; // a lone number here is the cash amount
          if (val != null) { cashp = val; got = true; }
        }
      }
      if (!got) { await speakAsync("I couldn't understand the amount. Please say it again, or type it."); return; }
      actionsRef.current.setTendered && actionsRef.current.setTendered(cashp);
      sharedRef.current.cashPaid = cashp;
    }

    const expected = Math.max(0, +(cashp - bill).toFixed(2));
    sharedRef.current.expectedChange = expected;
    await speakAsync(`Expected change is ${expected} rupees.`);

    // Ask before opening the real scanner; open ONLY on an explicit yes.
    await speakAsync("Should I open the scanner?");
    for (let i = 0; i < 3; i++) {
      const t = await listenOnceAsync();
      if (t != null) {
        const r = t.toLowerCase();
        if (YES_RE.test(r)) {
          await waitFor(() => !!actionsRef.current.openCamera, 2000);
          if (actionsRef.current.openCamera) { actionsRef.current.openCamera(); await speakAsync("Change scanner opened."); }
          else await speakAsync("I couldn't open the change scanner. Please try again.");
          return;
        }
        if (NO_RE.test(r)) { await speakAsync("Okay."); return; }
      }
      await speakAsync("I didn't understand. Should I open the scanner? Please say yes or no.");
    }
  }, [speakAsync, listenOnceAsync]);

  // --- command handling ---
  const doOpen = useCallback(async (key, phrase) => {
    if (key === "change") {
      navRef.current(PATH_FOR.change);
      const opened = await waitFor(() => pathRef.current === PATH_FOR.change, 2500);
      if (!opened) { await speakAsync("I couldn't open the change scanner. Please try again."); return; }
      await speakAsync("Change scanner opened.");
      await wait(300);
      await waitFor(() => !!actionsRef.current.setTendered, 2000);
      const bill = sharedRef.current.billAmount;
      const cashp = sharedRef.current.cashPaid;
      if (bill != null && cashp != null) {
        actionsRef.current.setBillAmount && actionsRef.current.setBillAmount(bill);
        actionsRef.current.setTendered && actionsRef.current.setTendered(cashp);
        const expected = Math.max(0, +(cashp - bill).toFixed(2));
        await speakAsync(`Expected change is ${expected} rupees.`);
      } else {
        await runChangeSetup();
      }
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
  }, [speakAsync, runChangeSetup]);

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

  const askCashToChange = useCallback(async () => {
    await speakAsync("Do you want to check your change?");
    for (let i = 0; i < 2; i++) {
      const t = await listenOnceAsync();
      if (t != null) {
        const s = t.toLowerCase();
        if (YES_RE.test(s)) {
          navRef.current("/change-checker");
          const opened = await waitFor(() => pathRef.current === "/change-checker", 2500);
          if (!opened) { await speakAsync("I couldn't open the change scanner. Please try again."); return true; }
          await speakAsync("Change scanner opened.");
          await wait(300);
          await waitFor(() => !!actionsRef.current.setTendered, 2000);
          await runChangeSetup({ assumeFromCash: true });
          return true;
        }
        if (NO_RE.test(s)) { await speakAsync("Okay."); return true; }
      }
      await speakAsync("Please say yes or no.");
    }
    return true;
  }, [speakAsync, listenOnceAsync, runChangeSetup]);

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
    if (res.ok && mod.key === "cash") return await askCashToChange();
    const trans = TRANSITIONS[mod.key];
    if (res.ok && trans) return await askTransition(trans);
    await speakAsync("What next?");
    return true;
  }, [speakAsync, askTransition, askCashToChange]);

  const handleCommand = useCallback(async (transcript) => {
    const s = transcript.toLowerCase().trim();
    const a = actionsRef.current;

    if (/\b(stop|exit|quit|turn off|goodbye|bye|cancel voice)\b/.test(s)) {
      await speakAsync("Voice assistant off."); return false;
    }
    if (/\b(start over|start again|new transaction|reset|clear all|clear everything)\b/.test(s)) {
      sharedRef.current = { billAmount: null, cashPaid: null, expectedChange: null, receivedChange: null };
      navRef.current("/");
      await speakAsync("Starting over. Bill, cash and change are cleared.");
      return true;
    }
    if (/\b(go back|^back$|\bback\b|previous)\b/.test(s) && !/\bbill|cash|change|home\b/.test(s)) {
      navRef.current(-1); await speakAsync("Going back."); return true;
    }
    if (/\b(home|main menu|main screen)\b/.test(s)) {
      navRef.current("/"); await speakAsync("Home opened."); return true;
    }

    const maybeExpected = async () => {
      const b = sharedRef.current.billAmount, c = sharedRef.current.cashPaid;
      if (b != null && c != null) {
        const e = Math.max(0, +(c - b).toFixed(2));
        sharedRef.current.expectedChange = e;
        await speakAsync(`Expected change is ${e} rupees.`);
      }
    };

    // change amount entry by voice — fills the REAL fields + shared store (only on Change screen)
    if (pathRef.current === "/change-checker" && /\d/.test(s) && !/\b(scan|open|capture)\b/.test(s)) {
      const ex = extractBillCash(s);
      let did = false;
      if (ex.bill != null && (/\bbill\b/.test(s) || ex.cash != null || sharedRef.current.billAmount == null)) {
        a.setBillAmount && a.setBillAmount(ex.bill); setSharedBill(ex.bill);
        await speakAsync(`Bill amount set to ${ex.bill} rupees.`); did = true;
      }
      if (ex.cash != null) {
        a.setTendered && a.setTendered(ex.cash); setSharedCash(ex.cash);
        await speakAsync(`Cash handed over set to ${ex.cash} rupees.`); did = true;
      }
      if (did) { await maybeExpected(); return true; }
    }

    // explicit cash / change scanner open commands (priority over generic capture)
    if (/\b(cash)\b/.test(s) && /\b(scan|open)\b/.test(s)) { await doOpen("cash", s); return true; }
    if (/\b(change)\b/.test(s) && /\b(scan|open)\b/.test(s)) { await doOpen("change", s); return true; }

    // capture
    if (/\b(capture|take a photo|take photo|scan now|snap|shoot|take picture|scan again|try again|rescan)\b/.test(s)) {
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

    // open / go to scanner (avoid triggering on amount phrases like "bill amount 180")
    const wantsOpen = /\b(open|go to|switch to|start|scan)\b/.test(s);
    let target = null;
    if (/\b(bill|receipt|invoice)\b/.test(s)) target = "bill";
    else if (/\b(cash|money|notes|currency)\b/.test(s)) target = "cash";
    else if (/\b(change)\b/.test(s)) target = "change";

    if (target && (wantsOpen || !/\d/.test(s))) { await doOpen(target, s); return true; }
    if (wantsOpen && !target) {
      await speakAsync("Which scanner would you like to open: bill, cash, or change?");
      return true;
    }

    await speakAsync(`I did not understand ${transcript}. You can say open bill, open cash, open change, capture, upload, analyze, go home, or go back.`);
    return true;
  }, [doCapture, doUpload, doAnalyze, doOpen, speakAsync, setSharedBill, setSharedCash]);

  const runLoop = useCallback(async () => {
    // If activated while on the Change screen, go straight into the guided amount entry.
    if (pathRef.current === "/change-checker") {
      await runChangeSetup();
    } else {
      await speakAsync("Voice assistant ready. Say open bill, open cash, open change, or go home. Say stop to exit.");
    }
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
  }, [handleCommand, listenOnceAsync, speakAsync, runChangeSetup]);

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

  const value = { handsFree, status, supported, toggleHandsFree, startHandsFree, stopHandsFree, registerActions, setSharedBill, setSharedCash, setSharedReceived };
  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
