/**
 * Content script — scrapes metadata from the active page and returns it to
 * the background worker, which relays it to the popup's add-item form.
 *
 * Extraction priority per field is documented in the design doc (section 6).
 * Every extractor is defensive: a missing element or parse failure returns
 * null so the popup falls back to manual entry rather than crashing.
 */

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== "GET_PAGE_META") return false;
    sendResponse(extractPageMeta());
    return false;
  });
}

function extractPageMeta() {
  return {
    url: window.location.href,
    title: extractTitle(),
    description: extractDescription(),
    contentType: extractContentType(),
    timeEstimate: extractTimeEstimate(),
    topic: extractTopic(),
  };
}

// ── Title ──────────────────────────────────────────────────
function extractTitle() {
  return (
    metaContent("og:title") ??
    metaContent("twitter:title") ??
    (document.title?.trim() || null)
  );
}

// ── Description ────────────────────────────────────────────
function extractDescription() {
  return (
    metaContent("og:description") ??
    metaContent("twitter:description") ??
    metaContent(null, "description") ??
    null
  );
}

// ── Content type ───────────────────────────────────────────
function extractContentType() {
  const host = window.location.hostname;

  if (/youtube\.com|youtu\.be/.test(host)) return "video";
  if (/vimeo\.com/.test(host)) return "video";

  const ogType = metaContent("og:type");
  if (ogType === "video.other" || ogType === "video.movie") return "video";
  if (ogType === "article") return "article";

  return "article"; // sensible default
}

// ── Time estimate ──────────────────────────────────────────
function extractTimeEstimate() {
  const contentType = extractContentType();

  if (contentType === "video") {
    return extractVideoDuration();
  }
  return extractReadTime();
}

function extractVideoDuration() {
  // 1. YouTube player duration element
  const ytDuration = document.querySelector(".ytp-time-duration");
  if (ytDuration?.textContent) {
    const mins = parseDurationString(ytDuration.textContent.trim());
    if (mins) return mins;
  }

  // 2. VideoObject JSON-LD schema
  const jsonLd = extractJsonLd("VideoObject");
  if (jsonLd?.duration) {
    const mins = parseIsoDuration(jsonLd.duration);
    if (mins) return mins;
  }

  return null;
}

function extractReadTime() {
  // 1. Twitter/Medium read-time meta (twitter:data1 = "X min read")
  const twitterData = metaContent(null, null, "twitter:data1");
  if (twitterData) {
    const match = twitterData.match(/(\d+)\s*min/i);
    if (match) return parseInt(match[1], 10);
  }

  // 2. Word count of <article> element ÷ 200 wpm
  const article = document.querySelector("article");
  if (article) {
    const text = (article.innerText ?? article.textContent ?? "").trim();
    const words = text ? text.split(/\s+/).length : 0;
    if (words > 50) return Math.max(1, Math.round(words / 200));
  }

  // 3. Word count of <main> as a fallback
  const main = document.querySelector("main");
  if (main) {
    const text = (main.innerText ?? main.textContent ?? "").trim();
    const words = text ? text.split(/\s+/).length : 0;
    if (words > 50) return Math.max(1, Math.round(words / 200));
  }

  return null;
}

// ── Topic hints ────────────────────────────────────────────
function extractTopic() {
  // og:section (e.g. "Technology")
  const section = metaContent("og:section");
  if (section) return section.trim();

  // article:tag — use the first tag
  const tag = metaContent("article:tag");
  if (tag) return tag.trim();

  // keywords meta — use the first keyword
  const keywords = metaContent(null, "keywords");
  if (keywords) {
    const first = keywords.split(",")[0]?.trim();
    if (first) return first;
  }

  return null;
}

// ── Meta tag helpers ───────────────────────────────────────

/**
 * Reads a <meta> tag's content attribute.
 *
 * Three calling forms:
 *   metaContent("og:title")            → property="og:title"
 *   metaContent(null, "description")   → name="description"
 *   metaContent(null, null, "twitter:data1") → name="twitter:data1"
 */
function metaContent(property, name, nameAlt) {
  if (property) {
    const el = document.querySelector(`meta[property="${property}"]`);
    if (el) return el.getAttribute("content") || null;
  }
  const nameAttr = name ?? nameAlt;
  if (nameAttr) {
    const el = document.querySelector(`meta[name="${nameAttr}"]`);
    if (el) return el.getAttribute("content") || null;
  }
  return null;
}

// ── JSON-LD helpers ────────────────────────────────────────
function extractJsonLd(type) {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      // Handle both single objects and @graph arrays
      const nodes = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
      for (const node of nodes) {
        if (node["@type"] === type) return node;
      }
    } catch {
      // Malformed JSON-LD — skip it
    }
  }
  return null;
}

// ── Duration parsers ───────────────────────────────────────

/** Parses "4:32" or "1:04:32" → whole minutes */
function parseDurationString(str) {
  const parts = str.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] + Math.round(parts[1] / 60);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + Math.round(parts[2] / 60);
  return null;
}

/** Parses ISO 8601 duration "PT4M32S" → whole minutes */
function parseIsoDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const hours = parseInt(match[1] ?? "0", 10);
  const mins = parseInt(match[2] ?? "0", 10);
  const secs = parseInt(match[3] ?? "0", 10);
  return hours * 60 + mins + Math.round(secs / 60) || null;
}

export {
  extractPageMeta,
  extractTitle,
  extractDescription,
  extractContentType,
  extractTimeEstimate,
  extractTopic,
  parseDurationString,
  parseIsoDuration,
};
