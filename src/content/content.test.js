// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";
import {
  extractTitle,
  extractDescription,
  extractContentType,
  extractTimeEstimate,
  extractTopic,
  parseDurationString,
  parseIsoDuration,
  extractPageMeta,
} from "./content.js";

// ── Helpers ────────────────────────────────────────────────

function setMeta(attrs) {
  const el = document.createElement("meta");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.head.appendChild(el);
}

function setJsonLd(obj) {
  const el = document.createElement("script");
  el.type = "application/ld+json";
  el.textContent = JSON.stringify(obj);
  document.head.appendChild(el);
}

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.title = "";
});

// ── parseDurationString ────────────────────────────────────

describe("parseDurationString", () => {
  it("parses MM:SS format", () => {
    expect(parseDurationString("4:32")).toBe(5); // 4m + round(32/60)=1 → 5
  });

  it("parses MM:SS with zero seconds", () => {
    expect(parseDurationString("10:00")).toBe(10);
  });

  it("parses HH:MM:SS format", () => {
    expect(parseDurationString("1:04:30")).toBe(65); // 60 + 4 + round(30/60)=1 → 65
  });

  it("rounds seconds to nearest minute", () => {
    expect(parseDurationString("3:29")).toBe(3); // 29s rounds down
    expect(parseDurationString("3:30")).toBe(4); // 30s rounds up
  });

  it("returns null for non-numeric input", () => {
    expect(parseDurationString("abc")).toBeNull();
    expect(parseDurationString("")).toBeNull();
  });
});

// ── parseIsoDuration ───────────────────────────────────────

describe("parseIsoDuration", () => {
  it("parses minutes and seconds", () => {
    expect(parseIsoDuration("PT4M32S")).toBe(5);
  });

  it("parses hours, minutes, seconds", () => {
    expect(parseIsoDuration("PT1H4M30S")).toBe(65);
  });

  it("parses minutes only", () => {
    expect(parseIsoDuration("PT10M")).toBe(10);
  });

  it("parses hours only", () => {
    expect(parseIsoDuration("PT2H")).toBe(120);
  });

  it("returns null for zero duration", () => {
    expect(parseIsoDuration("PT0M0S")).toBeNull();
  });

  it("returns null for unrecognized format", () => {
    expect(parseIsoDuration("not-a-duration")).toBeNull();
  });
});

// ── extractTitle ───────────────────────────────────────────

describe("extractTitle", () => {
  it("prefers og:title", () => {
    setMeta({ property: "og:title", content: "OG Title" });
    setMeta({ name: "twitter:title", content: "Twitter Title" });
    document.title = "Page Title";
    expect(extractTitle()).toBe("OG Title");
  });

  it("falls back to twitter:title when og:title is absent", () => {
    setMeta({ property: "twitter:title", content: "Twitter Title" });
    document.title = "Page Title";
    expect(extractTitle()).toBe("Twitter Title");
  });

  it("falls back to document.title as last resort", () => {
    document.title = "  Page Title  ";
    expect(extractTitle()).toBe("Page Title");
  });

  it("returns null when nothing is present", () => {
    expect(extractTitle()).toBeNull();
  });
});

// ── extractDescription ─────────────────────────────────────

describe("extractDescription", () => {
  it("prefers og:description", () => {
    setMeta({ property: "og:description", content: "OG desc" });
    setMeta({ name: "description", content: "meta desc" });
    expect(extractDescription()).toBe("OG desc");
  });

  it("falls back to meta name=description", () => {
    setMeta({ name: "description", content: "meta desc" });
    expect(extractDescription()).toBe("meta desc");
  });

  it("returns null when nothing is present", () => {
    expect(extractDescription()).toBeNull();
  });
});

// ── extractContentType ─────────────────────────────────────
// Note: hostname-based detection (youtube.com, vimeo.com) cannot be tested
// in jsdom because window.location is read-only in that environment.
// Those branches are simple regex checks that are correct by inspection.
// The og:type path covers the same logic and is fully testable.

describe("extractContentType", () => {
  it("returns video for og:type video.other", () => {
    setMeta({ property: "og:type", content: "video.other" });
    expect(extractContentType()).toBe("video");
  });

  it("returns video for og:type video.movie", () => {
    setMeta({ property: "og:type", content: "video.movie" });
    expect(extractContentType()).toBe("video");
  });

  it("returns article for og:type article", () => {
    setMeta({ property: "og:type", content: "article" });
    expect(extractContentType()).toBe("article");
  });

  it("defaults to article when no signals present", () => {
    expect(extractContentType()).toBe("article");
  });
});

// ── extractTimeEstimate (article path) ────────────────────

describe("extractTimeEstimate — article", () => {
  it("reads twitter:data1 read-time meta", () => {
    setMeta({ name: "twitter:data1", content: "5 min read" });
    expect(extractTimeEstimate()).toBe(5);
  });

  it("estimates from <article> word count", () => {
    // 400 words ÷ 200 wpm = 2 min
    document.body.innerHTML = `<article>${"word ".repeat(400)}</article>`;
    expect(extractTimeEstimate()).toBe(2);
  });

  it("falls back to <main> word count when no <article>", () => {
    document.body.innerHTML = `<main>${"word ".repeat(600)}</main>`;
    expect(extractTimeEstimate()).toBe(3);
  });

  it("ignores <article> with fewer than 50 words", () => {
    document.body.innerHTML = `<article>${"word ".repeat(20)}</article>`;
    expect(extractTimeEstimate()).toBeNull();
  });

  it("returns null when no signals present", () => {
    expect(extractTimeEstimate()).toBeNull();
  });
});

// ── extractTimeEstimate (video path) ──────────────────────
// Use og:type to trigger the video branch since window.location is
// read-only in jsdom.

describe("extractTimeEstimate — video", () => {
  beforeEach(() => {
    setMeta({ property: "og:type", content: "video.other" });
  });

  it("reads YouTube .ytp-time-duration element", () => {
    document.body.innerHTML = `<span class="ytp-time-duration">10:30</span>`;
    expect(extractTimeEstimate()).toBe(11);
  });

  it("reads VideoObject JSON-LD duration", () => {
    setJsonLd({ "@type": "VideoObject", duration: "PT6M45S" });
    expect(extractTimeEstimate()).toBe(7);
  });

  it("prefers DOM over JSON-LD when both present", () => {
    document.body.innerHTML = `<span class="ytp-time-duration">5:00</span>`;
    setJsonLd({ "@type": "VideoObject", duration: "PT10M" });
    expect(extractTimeEstimate()).toBe(5);
  });

  it("returns null when no video duration signals present", () => {
    expect(extractTimeEstimate()).toBeNull();
  });
});

// ── extractTopic ───────────────────────────────────────────

describe("extractTopic", () => {
  it("prefers og:section", () => {
    setMeta({ property: "og:section", content: "Technology" });
    setMeta({ property: "article:tag", content: "javascript" });
    expect(extractTopic()).toBe("Technology");
  });

  it("falls back to article:tag", () => {
    setMeta({ property: "article:tag", content: "  javascript  " });
    expect(extractTopic()).toBe("javascript");
  });

  it("falls back to first keyword from meta keywords", () => {
    setMeta({ name: "keywords", content: "javascript, web, tutorial" });
    expect(extractTopic()).toBe("javascript");
  });

  it("returns null when no topic signals present", () => {
    expect(extractTopic()).toBeNull();
  });
});

// ── extractPageMeta (integration) ─────────────────────────

describe("extractPageMeta", () => {
  it("returns all fields together", () => {
    setMeta({ property: "og:title", content: "Test Article" });
    setMeta({ property: "og:description", content: "A test." });
    setMeta({ name: "twitter:data1", content: "3 min read" });
    setMeta({ property: "og:section", content: "Dev" });

    const meta = extractPageMeta();

    expect(meta.title).toBe("Test Article");
    expect(meta.description).toBe("A test.");
    expect(meta.contentType).toBe("article");
    expect(meta.timeEstimate).toBe(3);
    expect(meta.topic).toBe("Dev");
    expect(meta.url).toBe(window.location.href);
  });

  it("returns null fields gracefully when page has no metadata", () => {
    const meta = extractPageMeta();
    expect(meta.title).toBeNull();
    expect(meta.description).toBeNull();
    expect(meta.timeEstimate).toBeNull();
    expect(meta.topic).toBeNull();
  });
});
