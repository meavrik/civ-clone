/// <reference types="vite/client" />
// The web game, unchanged: vite.config.ts hands its main.ts our display.ts, renderer.ts and
// storage.ts in place of its own. Around it: touch, the on-screen controls, saving when the phone
// puts the game away, and the service worker.
import "../../web/src/main.js";
import "./touch.js";
import "./controls.js";
import "./save.js";
import "./pwa.js";
