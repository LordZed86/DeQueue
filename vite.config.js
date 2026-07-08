import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
  plugins: [
    webExtension({
      manifest: "src/manifest.json",
      // content.js is injected on demand via chrome.scripting.executeScript
      // (see background.js) rather than declared in manifest.json's
      // content_scripts, so it needs to be listed here to still be bundled
      // and emitted to dist/.
      additionalInputs: ["src/content/content.js"],
    }),
  ],
  publicDir: "src/assets",
});
