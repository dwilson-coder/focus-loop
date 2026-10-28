const $ = (id) => document.getElementById(id);

const activityInput = $("activity");
const minutesInput = $("minutes");
const modeInput = $("mode");
const cyclesInput = $("cycles");

let intervalId = null;
let phase = "idle";
let pausedPhase = "work";
let endTime = 0;
let remainingMs = 0;
let phaseDurationMs = 0;
let completedWorkSessions = 0;
let config = null;

function safeMinutes(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(25, Math.max(15, parsed)) : 25;
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;
}

function render() {
  const running = phase === "work" || phase === "break";
  const paused = phase === "paused";

  $("clock").textContent = formatTime(remainingMs);
  $("phase").textContent =
    phase === "work" ? "Focus" :
    phase === "break" ? "Break" :
    phase === "paused" ? "Paused" :
    phase === "done" ? "Complete" : "Ready";

  $("progress").style.width = phaseDurationMs
    ? `${Math.min(100, 100 * (1 - remainingMs / phaseDurationMs))}%`
    : "0%";

  const sessionCount = config?.mode === "infinite" ? "∞" : config?.cycles;
  $("session-info").textContent = running || paused
    ? `${config.activity || "Focus session"} · Session ${completedWorkSessions + (phase === "work" ? 1 : 0)} of ${sessionCount}`
    : phase === "done"
      ? "Nice work. Your timer has finished."
      : "Set your activity and start when ready.";

  $("start").disabled = running || paused;
  $("pause").disabled = !running && !paused;
  $("pause").textContent = paused ? "Resume" : "Pause";
  $("stop").disabled = phase === "idle" || phase === "done";

  for (const input of [activityInput, minutesInput, modeInput, cyclesInput]) {
    if (input) input.disabled = running || paused;
  }
}

function notify(title, body) {
  if (window.focusLoop?.timerFinished) {
    window.focusLoop.timerFinished();
  } else if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function startPhase(nextPhase, durationMs) {
  clearInterval(intervalId);

  phase = nextPhase;
  phaseDurationMs = durationMs;
  remainingMs = durationMs;
  endTime = Date.now() + durationMs;

  intervalId = setInterval(tick, 200);
  render();
}

function tick() {
  remainingMs = Math.max(0, endTime - Date.now());

  if (remainingMs === 0) {
    clearInterval(intervalId);
    intervalId = null;
    finishPhase();
  } else {
    render();
  }
}

function finishPhase() {
  if (phase === "work") {
    completedWorkSessions += 1;

    const repeat =
      config.mode === "infinite" ||
      (config.mode === "count" && completedWorkSessions < config.cycles);

    if (repeat) {
      notify("Focus session complete", "Take a 5-minute break.");
      startPhase("break", 5 * 60 * 1000);
    } else {
      phase = "done";
      remainingMs = 0;
      phaseDurationMs = 1;
      notify("Timer complete", "You finished your planned focus sessions.");
      render();
    }

    return;
  }

  if (phase === "break") {
    notify("Break complete", "Time to focus again.");
    startPhase("work", config.minutes * 60 * 1000);
  }
}

function startTimer(options = {}) {
  clearInterval(intervalId);
  intervalId = null;

  const minutes = safeMinutes(options.minutes ?? minutesInput.value);
  const requestedMode = options.mode ?? modeInput.value;
  const mode = ["once", "count", "infinite"].includes(requestedMode)
    ? requestedMode
    : "once";
  const parsedCycles = Number.parseInt(options.cycles ?? cyclesInput.value, 10);
  const cycles = Math.min(99, Math.max(1, Number.isFinite(parsedCycles) ? parsedCycles : 1));
  const activity = String(options.activity ?? activityInput.value ?? "").slice(0, 100);

  minutesInput.value = String(minutes);
  modeInput.value = mode;
  cyclesInput.value = String(cycles);
  activityInput.value = activity;

  config = { minutes, mode, cycles: mode === "once" ? 1 : cycles, activity };
  completedWorkSessions = 0;

  startPhase("work", minutes * 60 * 1000);
}

$("mode").addEventListener("change", () => {
  $("cycle-setting").classList.toggle("hidden", modeInput.value !== "count");
});

$("start").addEventListener("click", () => startTimer());

$("pause").addEventListener("click", () => {
  if (phase === "work" || phase === "break") {
    pausedPhase = phase;
    remainingMs = Math.max(0, endTime - Date.now());
    clearInterval(intervalId);
    intervalId = null;
    phase = "paused";
  } else if (phase === "paused") {
    phase = pausedPhase;
    endTime = Date.now() + remainingMs;
    intervalId = setInterval(tick, 200);
  }

  render();
});

$("stop").addEventListener("click", () => {
  clearInterval(intervalId);
  intervalId = null;
  phase = "idle";
  config = null;
  completedWorkSessions = 0;
  remainingMs = safeMinutes(minutesInput.value) * 60 * 1000;
  phaseDurationMs = remainingMs;
  render();
});

if (window.focusLoop?.onStartFromLink) {
  window.focusLoop.onStartFromLink((options) => startTimer(options));
}

if ($("copyright-year")) {
  $("copyright-year").textContent = new Date().getFullYear();
}

remainingMs = safeMinutes(minutesInput.value) * 60 * 1000;
phaseDurationMs = remainingMs;
render();
