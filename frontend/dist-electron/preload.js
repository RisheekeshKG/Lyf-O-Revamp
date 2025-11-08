"use strict";
const electron = require("electron");
console.log("🔌 [Preload] Script loaded. Injecting APIs...");
const validInvokes = ["readDir", "readFile", "writeFile", "deleteFile"];
console.log("📡 [Preload] Allowed IPC channels:", validInvokes);
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // ---- invoke ----
  invoke: (channel, ...args) => {
    console.log(`[Preload → Renderer] invoke(${channel})`, args);
    if (!validInvokes.includes(channel)) {
      console.warn(`[Preload] ❌ Blocked invalid channel: ${channel}`);
      return Promise.reject(new Error("Invalid channel"));
    }
    return electron.ipcRenderer.invoke(channel, ...args);
  },
  // ---- Listen for messages from main ----
  onMainMessage: (cb) => {
    console.log("[Preload] Listening for 'fromMain' messages...");
    electron.ipcRenderer.on("fromMain", (_e, m) => {
      console.log("📬 [Main → Renderer] Message:", m);
      cb(m);
    });
  },
  // ---- Remove listener ----
  removeMainListener: () => {
    console.log("[Preload] Removed all 'fromMain' listeners.");
    electron.ipcRenderer.removeAllListeners("fromMain");
  }
});
console.log("✅ [Preload] electronAPI successfully injected.");
