/**
 * Background service worker.
 *
 * Responsibilities:
 *  - Handle GET_PAGE_META requests from the popup by injecting the content
 *    script into the active tab on demand (no persistent content_scripts
 *    entry — keeps the extension's host permissions to activeTab only).
 *  - Install-time setup (e.g. default settings) on first install.
 *
 * All storage reads/writes still go through utils/storage.js in the popup.
 * This worker only handles cross-context messaging.
 */

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    // Nothing to do yet — storage.js initializes defaults lazily on first read.
    console.log("DeQueue installed.");
  }
});

/**
 * On GET_PAGE_META, inject content.js into the active tab on demand, then
 * read its result back with a second, tiny inline script — no standing
 * content script, no message round-trip through a listener that may not
 * exist yet.
 *
 * Two steps because the build wraps content.js as a module IIFE, so its own
 * completion value isn't reliably the extraction result; content.js instead
 * stashes it on `window.__dequeuePageMeta` (see content.js) for this second
 * call to retrieve and clean up.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "GET_PAGE_META") return false;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs?.[0]?.id;
    if (!tabId) {
      sendResponse(null);
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["src/content/content.js"],
      },
      () => {
        if (chrome.runtime.lastError) {
          // Restricted page (chrome://, store pages) or a tab the extension
          // has no access to — that's fine, popup falls back to manual entry.
          sendResponse(null);
          return;
        }

        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: () => {
              const meta = window.__dequeuePageMeta ?? null;
              delete window.__dequeuePageMeta;
              return meta;
            },
          },
          (results) => {
            if (chrome.runtime.lastError) {
              sendResponse(null);
              return;
            }
            sendResponse(results?.[0]?.result ?? null);
          },
        );
      },
    );
  });

  return true; // Keep the message channel open for the async sendResponse.
});
