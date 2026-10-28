const $ = (id) => document.getElementById(id);

const activityInput = $("activity");
const minutesInput = $("minutes");
const modeInput = $("mode");
const cyclesInput = $("cycles");

let timerId = null;
let phase = "idle";
let endTime = 0;
let remainingMs = 0;
let phaseDurationMs = 0;
let completedWorkSessions = 0;
let config = null;
let pausedPhase = "work";


function safeMinutes(value) {
  const minutes = Number.parseInt(value, 10);
  return Math.min(25, Math.max(15, Number.isFinite(minutes) ? minutes : 25));
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function render() {
  const isRunning = phase === "work" || phase === "break";
  const isPaused = phase === "paused";

  $("clock").textContent = formatTime(remainingMs);
  $("phase").textContent =
    phase === "work" ? "Focus" :
    phase === "break" ? "Break" :
    phase === "paused" ? "Paused" :
    phase === "done" ? "Complete" : "Ready";

  $("progress").style.width = phaseDurationMs
    ? `${100 * (1 - remainingMs / phaseDurationMs)}%`
    : "0%";

  const task = config?.activity || "your activity";
  const total = config?.mode === "infinite" ? "∞" : config?.cycles;

  $("session-info").textContent = isRunning || isPaused
    ? `${task} · Session ${completedWorkSessions + (phase === "work" ? 1 : 0)} of ${total}`
    : phase === "done"
      ? "Nice work. Your timer has finished."
      : "Set your activity and start when ready.";

  $("start").disabled = isRunning;
  $("pause").disabled = !isRunning && !isPaused;
  $("pause").textContent = isPaused ? "Resume" : "Pause";
  $("stop").disabled = phase === "idle" || phase === "done";

  activityInput.disabled = isRunning || isPaused;
  minutesInput.disabled = isRunning || isPaused;
  modeInput.disabled = isRunning || isPaused;
  cyclesInput.disabled = isRunning || isPaused;
}

function startPhase(nextPhase, durationMs) {
  phase = nextPhase;
  phaseDurationMs = durationMs;
  remainingMs = durationMs;
  endTime = Date.now() + durationMs;

  clearInterval(timerId);
  timerId = setInterval(tick, 200);
  render();
}

function tick() {
  remainingMs = Math.max(0, endTime - Date.now());

  if (remainingMs <= 0) {
    clearInterval(timerId);
    timerId = null;
    finishPhase();
    return;
  }

  render();
}

function finishPhase() {
  if (phase === "work") {
    completedWorkSessions += 1;

    const shouldRepeat =
      config.mode === "infinite" ||
      (config.mode === "count" && completedWorkSessions < config.cycles);

    if (shouldRepeat) {
      notify("Focus session complete", "Take a 5-minute break.");
      startPhase("break", 5 * 60 * 1000);
    } else {
      completeTimer();
    }
    return;
  }

  if (phase === "break") {
    notify("Break complete", "Time to focus again.");
    startPhase("work", config.minutes * 60 * 1000);
  }
}

function completeTimer() {
  clearInterval(timerId);
  timerId = null;
  phase = "done";
  remainingMs = 0;
  phaseDurationMs = 1;
  notify("Timer complete", "You finished your planned focus sessions.");
  render();
}

function notify(title, body) {
  if (window.focusLoop?.timerFinished) {
    window.focusLoop.timerFinished();
  } else if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function startTimer(options = {}) {
  clearInterval(timerId);
  timerId = null;

  const minutes = safeMinutes(options.minutes ?? minutesInput.value);
  const mode = ["once", "count", "infinite"].includes(options.mode)
    ? options.mode
    : modeInput.value;

  const cycles = Math.min(
    99,
    Math.max(1, Number.parseInt(options.cycles ?? cyclesInput.value, 10) || 1)
  );

  const activity = String(options.activity ?? activityInput.value).slice(0, 100);

  minutesInput.value = String(minutes);
  modeInput.value = mode;
  cyclesInput.value = String(cycles);
  activityInput.value = activity;

  config = { minutes, mode, cycles, activity };
  completedWorkSessions = 0;

  if (mode === "once") {
    config.cycles = 1;
  }

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
    clearInterval(timerId);
    timerId = null;
    phase = "paused";
  } else if (phase === "paused") {
    phase = pausedPhase;
    endTime = Date.now() + remainingMs;
    timerId = setInterval(tick, 200);
  }

  render();
});


$("stop").addEventListener("click", () => {
  clearInterval(timerId);
  timerId = null;
  phase = "idle";
  remainingMs = safeMinutes(minutesInput.value) * 60 * 1000;
  phaseDurationMs = remainingMs;
  completedWorkSessions = 0;
  config = null;
  render();
});

if (window.focusLoop?.onStartFromLink) {
  window.focusLoop.onStartFromLink((options) => startTimer(options));
}

$("copyright-year").textContent = new Date().getFullYear();


remainingMs = Number(minutesInput.value) * 60 * 1000;
phaseDurationMs = remainingMs;
render();

