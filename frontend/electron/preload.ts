// electron/preload.ts
import { contextBridge, ipcRenderer } from "electron";

// ✅ Quick log to prove preload executed
console.log("🔌 [Preload] Script loaded. Injecting APIs...");

// ✅ Allowed IPC channels
const validInvokes = ["readDir", "readFile", "writeFile"];

// ✅ Optional: show what channels are allowed
console.log("📡 [Preload] Allowed IPC channels:", validInvokes);

// ✅ Safe bridge exposed to the renderer
contextBridge.exposeInMainWorld("electronAPI", {
  // ---- invoke ----
  invoke: (channel: string, ...args: any[]) => {
    console.log(`[Preload → Renderer] invoke(${channel})`, args);

    if (!validInvokes.includes(channel)) {
      console.warn(`[Preload] ❌ Blocked invalid channel: ${channel}`);
      return Promise.reject(new Error("Invalid channel"));
    }

    return ipcRenderer.invoke(channel, ...args);
  },

  // ---- Listen for messages from main ----
  onMainMessage: (cb: (msg: string) => void) => {
    console.log("[Preload] Listening for 'fromMain' messages...");
    ipcRenderer.on("fromMain", (_e, m) => {
      console.log("📬 [Main → Renderer] Message:", m);
      cb(m);
    });
  },

  // ---- Remove listener ----
  removeMainListener: () => {
    console.log("[Preload] Removed all 'fromMain' listeners.");
    ipcRenderer.removeAllListeners("fromMain");
  },
});

console.log("✅ [Preload] electronAPI successfully injected.");
