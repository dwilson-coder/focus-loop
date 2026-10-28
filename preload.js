const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("focusLoop", {
  onStartFromLink(callback) {
    ipcRenderer.on("start-from-link", (_event, options) => callback(options));
  },

  timerFinished() {
    ipcRenderer.send("timer-finished");
  }
});
