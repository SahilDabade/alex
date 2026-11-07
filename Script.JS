/* ============================================================
   ALEX — Virtual Assistant  |  Script.js
   ============================================================ */

// ── DOM refs ──────────────────────────────────────────────────
const btn = document.querySelector("#btn");
const content = document.querySelector("#content");
const statusBadge = document.getElementById("statusBadge");
const statusText = document.getElementById("statusText");
const logEntries = document.getElementById("logEntries");
const wakeHint = document.getElementById("wakeHint");
const clockEl = document.getElementById("clock");
const dateLine = document.getElementById("dateLine");
const batteryEl = document.getElementById("batteryDisplay");

// ── State ──────────────────────────────────────────────────────
let isListening = false;
let isAwake = false;
let pendingUrl = null;
let music = null;
let batteryManager = null;

// ── Clock & Date ───────────────────────────────────────────────
function updateClock() {

  const now = new Date();

  clockEl.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  dateLine.textContent = now.toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

setInterval(updateClock, 1000);

updateClock();

// ── Battery ────────────────────────────────────────────────────
if ("getBattery" in navigator) {

  navigator.getBattery().then(b => {

    batteryManager = b;

    function refreshBattery() {

      const pct = Math.floor(b.level * 100);

      const icon = b.charging
        ? "⚡"
        : (pct > 60 ? "🔋" : pct > 25 ? "🪫" : "❗");

      batteryEl.textContent = `${icon} ${pct}%`;
    }

    refreshBattery();

    b.addEventListener("levelchange", refreshBattery);

    b.addEventListener("chargingchange", refreshBattery);

  }).catch(err => {

    console.log(err);

    batteryEl.textContent = "Battery Unsupported";

  });

} else {

  batteryEl.textContent = "Battery Unsupported";
}

// ── Greeting on load ───────────────────────────────────────────
window.onload = () => {

  const h = new Date().getHours();

  const greeting =
    h < 12 ? "Good morning, Sir" :
    h < 17 ? "Good afternoon, Sir" :
    "Good evening, Sir";

  speak(greeting);

  addLog("system", `${greeting} — System initialised`);
};

// ── Speech synthesis ───────────────────────────────────────────
function speak(text, onDone) {

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.rate = 1;

  utterance.pitch = 1;

  utterance.volume = 1;

  utterance.lang = "en-US";

  let voices = window.speechSynthesis.getVoices();

  if (voices.length > 0) {

    const selectedVoice =
      voices.find(v => v.name.includes("Google US English")) ||
      voices.find(v => v.lang === "en-US") ||
      voices[0];

    utterance.voice = selectedVoice;
  }

  setStatus("speaking", text);

  addLog("alex", `Alex: ${text}`);

  utterance.onend = () => {

    if (isAwake) {

      setStatus("awake", "Listening...");

    } else if (isListening) {

      setStatus("listening", 'Say "Hey Alex" to wake me');
    }

    if (onDone) onDone();
  };

  window.speechSynthesis.speak(utterance);
}

// ── Load voices ────────────────────────────────────────────────
speechSynthesis.onvoiceschanged = () => {

  speechSynthesis.getVoices();
};

// ── Status UI ──────────────────────────────────────────────────
function setStatus(state, message) {

  statusBadge.className = `status-badge ${state}`;

  statusText.textContent = message;

  document.body.className =
    state === "listening" || state === "awake"
      ? "listening"
      : "";
}

// ── Log panel ──────────────────────────────────────────────────
function addLog(type, text) {

  const div = document.createElement("div");

  div.className = `log-entry ${type}`;

  div.textContent = text;

  logEntries.appendChild(div);

  logEntries.scrollTop = logEntries.scrollHeight;
}

function clearLog() {

  logEntries.innerHTML =
    '<div class="log-entry system">Log cleared.</div>';
}

// ── Speech recognition ─────────────────────────────────────────
const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (!SpeechRecognition) {

  addLog(
    "system",
    "⚠ Speech recognition not supported. Use Chrome or Edge."
  );

  btn.disabled = true;

  btn.textContent = "Browser not supported";

} else {

  const recognition = new SpeechRecognition();

  recognition.continuous = true;

  recognition.interimResults = false;

  recognition.lang = "en-US";

  // ── Result handler ──────────────────────────────────────────
  recognition.onresult = (e) => {

    const text =
      e.results[e.results.length - 1][0]
      .transcript
      .toLowerCase()
      .trim();

    content.textContent = text;

    addLog("user", `You: ${text}`);

    // Wake word
    if (!isAwake) {

      if (
        text.includes("alex") ||
        text.includes("hey alex")
      ) {

        isAwake = true;

        setStatus("awake", "Listening...");

        speak("Yes Sir, I'm listening");

        wakeHint.style.opacity = "0";
      }

      return;
    }

    setStatus("listening", "Processing...");

    takeCommand(text);
  };

  // ── Errors ──────────────────────────────────────────────────
  recognition.onerror = (e) => {

    addLog("system", `Recognition error: ${e.error}`);
  };

  // ── Auto restart ────────────────────────────────────────────
  recognition.onend = () => {

    if (isListening) {

      setTimeout(() => {

        try {

          recognition.start();

        } catch (err) {

          console.log(err);
        }

      }, 500);
    }
  };

  // ── Button ──────────────────────────────────────────────────
  btn.addEventListener("click", () => {

    // Open pending URL
    if (pendingUrl) {

      window.open(pendingUrl, "_blank");

      pendingUrl = null;

      addLog("system", "Link opened.");

      return;
    }

    // START
    if (!isListening) {

      isListening = true;

      try {

        recognition.start();

      } catch (err) {

        console.log(err);
      }

      content.textContent = "Listening...";

      setStatus("listening", 'Say "Hey Alex" to wake me');

      btn.textContent = "Stop";

      addLog(
        "system",
        'Microphone active — say "Hey Alex" to begin.'
      );
    }

    // STOP
    else {

      isListening = false;

      isAwake = false;

      recognition.stop();

      content.textContent = "Start Assistant";

      setStatus("idle", "Idle — Press Start");

      btn.textContent = "Start Assistant";

      wakeHint.style.opacity = "1";

      addLog("system", "Assistant stopped.");

      document.body.className = "";
    }
  });

  // ── Command handler ─────────────────────────────────────────
  function takeCommand(m) {

    // Greetings
    if (m.includes("hello") || m.includes("hi")) {

      speak("Hello Sir! How can I assist you today?");
    }

    // How are you
    else if (m.includes("how are you")) {

      speak("I'm running perfectly, Sir.");
    }

    // Identity
    else if (
      m.includes("who are you") ||
      m.includes("your name")
    ) {

      speak(
        "I'm Alex, your personal AI virtual assistant."
      );
    }

    // Time
    else if (
      m.includes("what time") ||
      m.includes("current time")
    ) {

      const t = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

      speak(`The current time is ${t}`);
    }

    // Date
    else if (
      m.includes("what date") ||
      m.includes("today")
    ) {

      const d = new Date().toLocaleDateString([], {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });

      speak(`Today is ${d}`);
    }

    // Battery
    else if (m.includes("battery")) {

      if (batteryManager) {

        const pct = Math.floor(
          batteryManager.level * 100
        );

        speak(`Battery is at ${pct} percent`);

      } else {

        speak("Battery information unavailable");
      }
    }

    // Open YouTube
    else if (m.includes("open youtube")) {

      pendingUrl = "https://www.youtube.com";

      speak("Opening YouTube. Click the button once.");
    }

    // Open Google
    else if (m.includes("open google")) {

      pendingUrl = "https://www.google.com";

      speak("Opening Google. Click the button once.");
    }

    // Open Instagram
    else if (m.includes("open instagram")) {

      pendingUrl = "https://www.instagram.com";

      speak("Opening Instagram. Click the button once.");
    }

    // Search
    else if (
      m.includes("search") ||
      m.includes("google")
    ) {

      const q = m
        .replace(/search|google/gi, "")
        .trim();

      if (q) {

        pendingUrl =
          `https://www.google.com/search?q=${encodeURIComponent(q)}`;

        speak(`Searching for ${q}`);

      } else {

        speak("What should I search?");
      }
    }

    // Wikipedia
    else if (
      m.includes("tell me about") ||
      m.includes("what is")
    ) {

      const q = m
        .replace(/tell me about|what is/gi, "")
        .trim();

      if (q) {

        pendingUrl =
          `https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`;

        speak(`Looking up ${q}`);
      }
    }

    // Joke
    else if (m.includes("joke")) {

      const jokes = [

        "Why do programmers hate nature? Too many bugs.",

        "I told my computer I needed a break. Now it sends KitKat ads.",

        "Why was JavaScript sad? Because it didn't Node how to Express itself."
      ];

      speak(
        jokes[Math.floor(Math.random() * jokes.length)]
      );
    }

    // Sleep
    else if (
      m.includes("sleep") ||
      m.includes("stop listening")
    ) {

      isAwake = false;

      setStatus("listening", 'Say "Hey Alex" to wake me');

      wakeHint.style.opacity = "1";

      speak("Going to sleep.");
    }

    // Thanks
    else if (
      m.includes("thank you") ||
      m.includes("thanks")
    ) {

      speak("Always a pleasure, Sir.");
    }

    // Goodbye
    else if (
      m.includes("goodbye") ||
      m.includes("bye")
    ) {

      speak("Goodbye Sir.");

      setTimeout(() => btn.click(), 3000);
    }

    // Fallback
    else {

      speak(
        "I didn't quite catch that. Could you rephrase?"
      );
    }
  }
}