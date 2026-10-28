const { app, BrowserWindow, ipcMain, Notification } = require("electron");
const path = require("node:path");

const PROTOCOL = "focusloop";
let mainWindow;
let queuedLink = null;

function parseTimerLink(rawUrl) {
  try {
    const url = new URL(rawUrl);

    if (url.protocol !== `${PROTOCOL}:`) return null;

    const minutes = Number.parseInt(url.searchParams.get("minutes") || "25", 10);
    const mode = url.searchParams.get("mode") || "once";
    const cycles = Number.parseInt(url.searchParams.get("cycles") || "1", 10);
    const activity = (url.searchParams.get("activity") || "").slice(0, 100);

    return {
      minutes: Math.min(25, Math.max(15, Number.isFinite(minutes) ? minutes : 25)),
      mode: ["once", "count", "infinite"].includes(mode) ? mode : "once",
      cycles: Math.min(99, Math.max(1, Number.isFinite(cycles) ? cycles : 1)),
      activity
    };
  } catch {
    return null;
  }
}

function sendLinkToApp(rawUrl) {
  const options = parseTimerLink(rawUrl);
  if (!options) return;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("start-from-link", options);
  } else {
    queuedLink = options;
  }
}

if (process.defaultApp) {
  // Allows the protocol to be tested while running Electron from the project.
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
    path.resolve(process.argv[1])
  ]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

const hasLock = app.requestSingleInstanceLock();

if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    const link = commandLine.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (link) sendLinkToApp(link);

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // macOS sends protocol links through this event.
  app.on("open-url", (event, rawUrl) => {
    event.preventDefault();
    sendLinkToApp(rawUrl);
  });

  ipcMain.on("timer-finished", () => {
    if (Notification.isSupported()) {
      new Notification({
        title: "Focus Loop",
        body: "Session complete."
      }).show();
    }
  });

  app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
      width: 440,
      height: 720,
      minWidth: 360,
      minHeight: 600,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    // For this small starter app, expose only a limited notification bridge.
    // The preload file is created below.
    mainWindow.loadFile("index.html");

    // Windows/Linux deliver a cold-start protocol link in process.argv.
    const startupLink = process.argv.find((arg) =>
      arg.startsWith(`${PROTOCOL}://`)
    );
    if (startupLink) sendLinkToApp(startupLink);

    mainWindow.webContents.on("did-finish-load", () => {
      if (queuedLink) {
        mainWindow.webContents.send("start-from-link", queuedLink);
        queuedLink = null;
      }
    });
  });
}
