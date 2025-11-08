/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string;
    VITE_PUBLIC: string;
  }
}

interface Window {
  electronAPI: {
    // Matches preload exactly
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    onMainMessage: (callback: (msg: string) => void) => void;
    removeMainListener: () => void;
  };
}
