import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "fs/promises";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Avoid vite define plugin issues
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC!, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
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

// ====== FILE SYSTEM HANDLERS ======

// ✅ Base data folder now OUTSIDE src/
const DATA_DIR = path.join(process.env.APP_ROOT!,'data');
 // <--- moved here!

// ---- Read directory ----
ipcMain.handle("readDir", async (_event, relativeDir?: string) => {
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

// ---- Read file ----
ipcMain.handle("readFile", async (_event, filename: string) => {
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

// ---- Write file ----
ipcMain.handle("writeFile", async (_event, filename: string, content: string) => {
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
