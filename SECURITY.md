# Security Policy

## Supported Versions

DeQueue is under active development. Only the latest release is supported
with security fixes.

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| < 1.1   | :x:                |

## Reporting a Vulnerability

If you find a security vulnerability in DeQueue, please **do not open a
public issue**. Instead, use GitHub's private reporting:

1. Go to the [Security tab](../../security/advisories/new) of this repository
2. Click **Report a vulnerability**
3. Include a description of the issue, steps to reproduce, and potential
   impact

You should expect an initial response within a few days. Since this is a
student project maintained outside a formal organization, timelines are
best-effort rather than guaranteed.

## Scope

DeQueue is a browser extension that stores all data locally (`localStorage`
and `chrome.storage.session`) and does not transmit user data to any
server. Reports most relevant to this project include:

- Content script / page metadata scraping issues (e.g. unsafe parsing of
  untrusted page content)
- Cross-site scripting via saved item data rendered in the popup or options
  UI
- Manifest / permissions issues that request broader access than needed
