import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "fs/promises";
createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
const DATA_DIR = path.join(process.env.APP_ROOT, "data");
ipcMain.handle("readDir", async (_event, relativeDir) => {
  try {
    const fullPath = relativeDir ? path.join(DATA_DIR, relativeDir) : DATA_DIR;
    const files = await fs.readdir(fullPath);
    console.log("📂 Reading directory:", fullPath);
    return files;
  } catch (error) {
    console.error("❌ Error reading directory:", error);
    return [];
  }
});
ipcMain.handle("readFile", async (_event, filename) => {
  try {
    const safeName = path.basename(filename);
    const filePath = path.join(DATA_DIR, safeName);
    const data = await fs.readFile(filePath, "utf-8");
    console.log("📖 Reading file:", filePath);
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Error reading file ${filename}:`, error);
    return null;
  }
});
ipcMain.handle("writeFile", async (_event, filename, content) => {
  try {
    const safeName = path.basename(filename);
    const filePath = path.join(DATA_DIR, safeName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
    console.log(`✅ Successfully wrote to: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error writing file ${filename}:`, error);
    throw error;
  }
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
