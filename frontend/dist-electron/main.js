import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "fs/promises";
import fsSync from "fs";
createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
console.log("🔧 __dirname =", __dirname);
console.log("🔧 process.env.APP_ROOT =", process.env.APP_ROOT);
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
console.log("🌍 ENV CHECK:");
console.log("   VITE_DEV_SERVER_URL =", VITE_DEV_SERVER_URL);
console.log("   MAIN_DIST =", MAIN_DIST);
console.log("   RENDERER_DIST =", RENDERER_DIST);
console.log("   VITE_PUBLIC =", process.env.VITE_PUBLIC);
let win;
const IS_DEV = Boolean(VITE_DEV_SERVER_URL);
console.log("🔎 Running mode:", IS_DEV ? "DEV" : "PROD");
const DEV_DATA_DIR = path.resolve(process.env.APP_ROOT, "../frontend/data");
const PROD_DATA_DIR = path.join(app.getPath("userData"), "data");
const DATA_DIR = IS_DEV ? DEV_DATA_DIR : PROD_DATA_DIR;
console.log("📁 DEV_DATA_DIR =", DEV_DATA_DIR);
console.log("📁 PROD_DATA_DIR =", PROD_DATA_DIR);
console.log("📁 Active DATA_DIR =", DATA_DIR);
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`📂 Ensured data dir: ${DATA_DIR}`);
    if (!fsSync.existsSync(DATA_DIR)) {
      console.warn("⚠️ Data folder not found!");
    } else {
      console.log("📄 Files inside data:", fsSync.readdirSync(DATA_DIR));
    }
  } catch (err) {
    console.error("❌ Failed to create data dir:", err);
  }
}
function resolvePreloadPath() {
  const possiblePaths = [
    path.join(__dirname, "preload.js"),
    // when built together
    path.join(__dirname, "../dist-electron/preload.js"),
    // fallback (backend style)
    path.join(__dirname, "../../frontend/dist-electron/preload.js")
    // actual dev path
  ];
  console.log("🧭 Checking preload paths:");
  possiblePaths.forEach((p) => {
    console.log("   →", p, fsSync.existsSync(p) ? "✅ exists" : "❌ missing");
  });
  for (const p of possiblePaths) {
    if (fsSync.existsSync(p)) {
      console.log("⚙️ Using preload script:", p);
      return p;
    }
  }
  console.error("❌ No valid preload script found!");
  return possiblePaths[0];
}
function createWindow() {
  console.log("🚪 Creating main window...");
  const preloadPath = resolvePreloadPath();
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    width: 1e3,
    height: 700,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  console.log("🪟 BrowserWindow created with preload:", preloadPath);
  win.webContents.on("did-finish-load", () => {
    console.log("✅ Renderer finished loading.");
    win == null ? void 0 : win.webContents.send(
      "fromMain",
      `👋 Hello from main process! (Mode: ${IS_DEV ? "DEV" : "PROD"})`
    );
  });
  win.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error("❌ Renderer failed to load:", code, desc);
  });
  if (VITE_DEV_SERVER_URL) {
    console.log("🌐 Loading DEV URL:", VITE_DEV_SERVER_URL);
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    const htmlPath = path.join(RENDERER_DIST, "index.html");
    console.log("📄 Loading HTML file:", htmlPath);
    win.loadFile(htmlPath);
  }
  win.on("closed", () => console.log("🪟 Window closed."));
}
app.whenReady().then(async () => {
  console.log("🚀 Electron app ready.");
  await ensureDataDir();
  createWindow();
});
app.on("window-all-closed", () => {
  console.log("🧹 All windows closed.");
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  console.log("🔁 App activate event.");
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
ipcMain.handle("readDir", async (_event, relativeDir) => {
  console.log("📂 IPC → readDir called with:", relativeDir);
  try {
    const fullPath = relativeDir ? path.join(DATA_DIR, relativeDir) : DATA_DIR;
    console.log("   Reading directory:", fullPath);
    const files = await fs.readdir(fullPath, { withFileTypes: true });
    const fileList = files.filter((f) => f.isFile()).map((f) => f.name);
    console.log("   Files found:", fileList);
    return fileList;
  } catch (error) {
    console.error("❌ Error reading directory:", error);
    return [];
  }
});
ipcMain.handle("readFile", async (_event, filename) => {
  console.log("📖 IPC → readFile called:", filename);
  try {
    const safeName = path.basename(filename);
    const filePath = path.join(DATA_DIR, safeName);
    const data = await fs.readFile(filePath, "utf-8");
    console.log("   Successfully read:", filePath);
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Error reading file ${filename}:`, error);
    return null;
  }
});
ipcMain.handle("writeFile", async (_event, filename, content) => {
  console.log("💾 IPC → writeFile called:", filename);
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
