// Browser Text-to-Speech and Speech Recognition helpers

export const isTTSSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

let _cancelPrev = true;

export function speak(text, { interrupt = true } = {}) {
  if (!isTTSSupported() || !text) return;
  try {
    if (interrupt && _cancelPrev) window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    utter.volume = 1;
    utter.lang = "en-IN";
    window.speechSynthesis.speak(utter);
  } catch (e) {
    /* no-op */
  }
}

export function stopSpeaking() {
  if (isTTSSupported()) window.speechSynthesis.cancel();
}

export const getSpeechRecognition = () => {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export const isSpeechRecognitionSupported = () => !!getSpeechRecognition();

// Listen once and return the transcript
export function listenOnce({ onResult, onError, onStart, onEnd } = {}) {
  const SR = getSpeechRecognition();
  if (!SR) {
    onError && onError("unsupported");
    return null;
  }
  const recognition = new SR();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onstart = () => onStart && onStart();
  recognition.onerror = (e) => onError && onError(e.error || "error");
  recognition.onend = () => onEnd && onEnd();
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    onResult && onResult(transcript);
  };
  try {
    recognition.start();
  } catch (e) {
    onError && onError("start-failed");
  }
  return recognition;
}
