/// <reference types="vite/client" />
// The web game, unchanged: vite.config.ts hands its main.ts our display.ts, renderer.ts and
// storage.ts in place of its own. Around it: touch (no buttons: the screen is all there is), the
// prompt's text field, saving when the phone puts the game away, and the service worker.
import "../../web/src/main.js";
import "./touch.js";
import "./text.js";
import "./save.js";
import "./pwa.js";
