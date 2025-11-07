import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Listen for message from Electron main process
if (window.electronAPI) {
  window.electronAPI.onMainMessage((msg: string) => {
    console.log("📩 Message from main process:", msg);
  });
} else {
  console.warn("⚠️ electronAPI not found — preload may not be loaded");
}

