# HireFlow — LinkedIn Hiring Post Scraper Chrome Extension

![HireFlow Logo](public/hireflow-logo-transparent.png)

A production-ready Google Chrome extension (Manifest V3) built with React, TypeScript, and Vite. **HireFlow** helps engineers, job seekers, and recruiters extract structured hiring posts containing publicly visible contact emails directly from LinkedIn post search results.

---

## 🚀 Key Features

* **Strict Email-First Extraction**: Filters out noise. Only posts containing a verified, detectable contact email (`hiring@...`, `jobs@...`, `careers@...`, `hr@...`) are saved.
* **Progressive DOM Crawler**: Gracefully inspects rendered posts, auto-expands `...see more` buttons, and triggers gentle infinite scrolling with rate controls.
* **Layered DOM Adapter**: Centralized `LinkedInAdapter` implementing the `PlatformAdapter` interface with primary selectors, fallback selectors, and semantic heuristics to stay resilient against LinkedIn DOM updates.
* **Smart Deduplication**: Multi-tier deduplication utilizing LinkedIn URNs/activity IDs, canonical URLs, and normalized author + content hashes.
* **Privacy & Local Processing**: 100% local in-browser processing. Zero post data or credentials ever leave your browser.
* **One-Click Export & Copy**: Download structured JSON (`hireflow-linkedin-YYYY-MM-DD.json`) or copy directly to clipboard with instant toast confirmation.
* **Future LLM Pipeline Ready**: Preserves raw visible text intact, formatted for seamless downstream processing into structured job records (e.g. skills, tech stack, salary, remote work mode).

---

## 🏗️ Architecture

```text
┌────────────────────────────────────────────────────────┐
│                      Popup UI                          │
│            (React + TypeScript + Vite)                 │
│  - Select post target (5, 10, 30, 50, 100, Custom)    │
│  - Real-time progress bar & live counters              │
│  - Post preview cards & JSON export / copy             │
└───────────────────────────┬────────────────────────────┘
                            │ chrome.runtime.sendMessage
                            ▼
┌────────────────────────────────────────────────────────┐
│              Background Service Worker                 │
│            (MV3 Ephemeral Service Worker)              │
│  - Badge updates (live counter & status)               │
│  - Tab navigation & injection fallback                │
└───────────────────────────┬────────────────────────────┘
                            │ chrome.tabs.sendMessage
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Content Script                       │
│        (linkedin-content.ts in page context)           │
│                                                        │
│  ┌────────────────────┐      ┌──────────────────────┐  │
│  │    Post Scanner    │ ◄──► │   LinkedIn Adapter   │  │
│  │ (Progressive loop, │      │ (Layered selectors,  │  │
│  │  rate throttling,  │      │  see-more expansion, │  │
│  │  graceful stop)    │      │  DOM detection)      │  │
│  └─────────┬──────────┘      └──────────────────────┘  │
│            │                                           │
│            ▼                                           │
│  ┌────────────────────┐      ┌──────────────────────┐  │
│  │  Email Extractor   │      │   Post Deduplicator  │  │
│  │ (Regex + RFC-5322, │ ───► │ (Activity URN, URL,  │  │
│  │  normalization,    │      │  normalized content  │  │
│  │  bracket stripping)│      │  hash)               │  │
│  └────────────────────┘      └──────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 📦 Getting Started

### 1. Prerequisites

* Node.js `>= 18.0.0` (Tested on Node v22)
* npm `>= 9.0.0`
* Google Chrome (or Chromium-based browser)

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/codesbysagar/hireflow-extension.git
cd hireflow-extension
npm install
```

### 3. Build

Run the production build:

```bash
npm run build
```

This compiles:
1. `popup.html` and the React UI into `dist/`
2. `background.js` (Manifest V3 Service Worker) into `dist/background.js`
3. `content.js` (Standalone Content Script) into `dist/content.js`
4. Assets and icons (`16x16`, `32x32`, `48x48`, `128x128`) into `dist/icons/`

### 4. Load Unpacked Extension in Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** via the toggle in the upper-right corner.
3. Click **Load unpacked**.
4. Select the `dist/` directory inside this project folder.
5. HireFlow is now installed! Pin it to your Chrome toolbar for easy access.

---

## 🎯 How to Use

1. **Open LinkedIn**: Go to [LinkedIn](https://www.linkedin.com).
2. **Search for Hiring Posts**: In the LinkedIn search bar, search for relevant hiring terms:
   * `Golang hiring`
   * `Senior Backend Developer hiring`
   * `Python Developer`
   * `Remote React hiring`
3. **Filter by Posts**: Click the **Posts** filter tab on LinkedIn. You can apply additional LinkedIn filters (e.g. *Date posted: Past 24 hours*).
4. **Open HireFlow**: Click the HireFlow icon in the Chrome toolbar.
5. **Select Scan Target**: Choose how many matching posts with emails you wish to find (`5`, `10`, `30`, `50`, `100`, or a `Custom` number).
6. **Start Extraction**: Click **Start Extraction**.
7. **Watch Live Progress**: HireFlow progressively scrolls, discovers posts, expands text, and matches contact emails in real-time.
8. **Export**: Preview the recruiter cards, copy the JSON to clipboard, or download the `hireflow-linkedin-YYYY-MM-DD.json` file.

---

## 📊 Extracted Data Schema

HireFlow outputs standard RFC-compliant JSON adhering to the `RawHiringPost` data model:

```json
{
  "source": "linkedin",
  "extractedAt": "2026-09-30T10:00:00.000Z",
  "searchUrl": "https://www.linkedin.com/search/results/content/?keywords=golang%20hiring",
  "searchQuery": "golang hiring",
  "totalScanned": 18,
  "totalMatched": 5,
  "posts": [
    {
      "id": "71829384918239",
      "platform": "linkedin",
      "postUrl": "https://www.linkedin.com/feed/update/urn:li:activity:71829384918239/",
      "author": {
        "name": "Jane Doe",
        "profileUrl": "https://www.linkedin.com/in/janedoe",
        "headline": "Lead Tech Recruiter @ CloudScale"
      },
      "text": "We are hiring Senior Golang Engineers!\nLocation: Remote\nExperience: 3-5 years\nSend your resume to: hiring@cloudscale.io",
      "emails": [
        "hiring@cloudscale.io"
      ],
      "extractedAt": "2026-09-30T10:00:05.120Z",
      "searchContext": {
        "query": "golang hiring",
        "pageUrl": "https://www.linkedin.com/search/results/content/?keywords=golang%20hiring"
      }
    }
  ]
}
```

---

## 🔮 Future LLM Pipeline Architecture

HireFlow was engineered with an LLM ingestion pipeline in mind:

```text
LinkedIn Search Results
         │
         ▼
HireFlow Chrome Extension
         │
         ▼
RawHiringPost[] JSON (Raw Text Intact)
         │
         ▼
Future LLM Processor (Claude / Gemini / GPT)
         │  - Extracts: Job Title, Company, Work Mode, Tech Stack,
         │    Years of Experience, Salary Range, Recruiter Name
         ▼
StructuredJob Model
         │
         ▼
HireFlow Database & Job Dashboard
```

The `StructuredJob` interface in [`src/shared/types.ts`](src/shared/types.ts) defines this target schema.

---

## 🧪 Testing

The repository includes a comprehensive unit test suite powered by Vitest and happy-dom:

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# TypeScript typechecking
npm run typecheck
```

### Test Coverage Highlights:
* **Email Extractor**: Standard formats, angle brackets (`<hiring@... >`), parentheses, square brackets, subdomains (`.co.in`), multiple slash-separated emails, obfuscated addresses (`[at]`, `[dot]`), and image asset false-positive rejection (`logo@2x.png`).
* **Deduplication**: By activity URN, canonical LinkedIn URL, and normalized content signature hash.
* **Post Filtering**: Ensuring posts without detectable emails are rejected while valid posts are accepted.
* **Quantity Validation**: Verifying predefined options, custom boundaries (`1` to `500`), non-integer handling, and NaN rejection.
* **Scanner State Machine**: State transitions (`idle` → `scanning` → `complete`, `stopped`, and `error`).

---

## 🛡️ Permissions & Security

| Permission | Justification |
| :--- | :--- |
| `storage` | Persists user settings, target scan count, and latest extraction results across popup opens. |
| `activeTab` | Accesses the currently active tab when the extension popup is opened. |
| `tabs` | Reads the active tab's URL to verify that the user is on a supported LinkedIn search page. |
| `scripting` | Enables fallback content script injection if the LinkedIn page was loaded prior to extension installation. |
| `host_permissions` | Scoped strictly to `https://www.linkedin.com/*`. No access to any other website. |

---

## 🔧 Rate Control & Safe Crawling

To ensure stability and respect browser resources, HireFlow enforces conservative rate limits:
* `SCAN_DELAY_MS` (500ms): Pacing delay between post inspections.
* `SCROLL_DELAY_MS` (1200ms): Wait duration after each incremental page scroll.
* `EXPAND_DELAY_MS` (250ms): Settling delay after clicking `...see more`.
* `MAX_IDLE_RETRIES` (5): Stops scrolling once LinkedIn reaches the end of search results.
* `MAX_SCROLL_ATTEMPTS` (60): Hard ceiling preventing runaway scanning loops.

---

## 🛠️ Troubleshooting

* **"Open a LinkedIn post search page to start extracting"**: Ensure you have navigated to `https://www.linkedin.com/search/results/content/` (search for any keywords and select the **Posts** tab).
* **"No hiring posts containing contact emails were found"**: LinkedIn search results contained posts, but none included publicly visible email addresses. Try adjusting your search query (e.g. add `email` or `resume` to your search query: `"Golang hiring" "email"`).
* **DOM Changes**: If LinkedIn updates class names, the layered selectors in [`src/content/linkedin-adapter.ts`](src/content/linkedin-adapter.ts) will fallback to URN and semantic attributes. Additional selectors can be added to `LINKEDIN_SELECTORS`.

---

## 📄 License

MIT License. Built for developers by [Sagar Sharma](https://github.com/codesbysagar).
