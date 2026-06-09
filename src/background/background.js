/**
 * Background service worker.
 *
 * Responsibilities:
 *  - Relay GET_PAGE_META requests from the popup to the content script on the
 *    active tab (popup can't message content scripts directly in MV3).
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
 * Relay messages from the popup to the content script on the active tab.
 *
 * The popup sends:  { type: "GET_PAGE_META" }
 * We forward it to the content script and pass the response back.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "GET_PAGE_META") return false;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs?.[0]?.id;
    if (!tabId) {
      sendResponse(null);
      return;
    }

    chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_META" }, (meta) => {
      if (chrome.runtime.lastError) {
        // Content script not injected on this page (e.g. chrome:// URLs) — that's fine.
        sendResponse(null);
        return;
      }
      sendResponse(meta);
    });
  });

  return true; // Keep the message channel open for the async sendResponse.
});
