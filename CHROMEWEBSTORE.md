# Chrome Web Store Listing — HireFlow

## 1. Store Listing Metadata

* **Name**: HireFlow - LinkedIn Hiring Post Extractor
* **Summary** (max 132 chars):
  Extract structured hiring opportunities and recruiter contact emails from LinkedIn search results into clean, exportable JSON.
* **Category**: Productivity / Developer Tools
* **Primary Language**: English

---

## 2. Detailed Description

HireFlow is a productivity extension designed for software engineers, contractors, and recruiters. When searching for hiring posts on LinkedIn, recruiters frequently share direct contact emails for open roles. HireFlow helps you scan visible search results, automatically filter for posts containing verified recruiter contact emails, and export structured hiring data into clean JSON format.

### Key Features

* **Email-First Filtering**: Only posts with verified contact emails (such as hiring@, jobs@, careers@, or recruiter addresses) are saved. Posts without contact information are automatically filtered out.
* **Controlled Scanning**: Select how many posts you want to extract (5, 10, 30, 50, 100, or a custom target).
* **Live Progress**: Monitor discovered posts, scanned posts, and email matches in real-time.
* **Instant Export**: Copy results directly to your clipboard or download as a standardized JSON file.
* **Local & Private**: All extraction and filtering occurs entirely inside your browser. No post content, search terms, or personal data are ever sent to external servers.

---

## 3. Permissions Justification

| Permission | Technical Justification |
| :--- | :--- |
| `storage` | Saves user scan preferences (e.g. preferred post count) and retains extracted hiring records locally in the browser so data is not lost when closing the extension popup. |
| `activeTab` | Accesses the user's currently focused LinkedIn search tab when the extension popup is activated. |
| `tabs` | Checks whether the active tab is a supported LinkedIn post search page (`linkedin.com/search/results/content/`) and extracts the search query context. |
| `scripting` | Enables content script injection if the extension is installed or updated while a LinkedIn tab is already open. |
| `host_permissions` (`https://www.linkedin.com/*`) | Required to read and inspect publicly visible hiring posts on LinkedIn search results pages initiated by the user. |

---

## 4. Privacy & Data Use Disclosure

* **Single Purpose**: Extract visible hiring post data and contact emails from user-initiated LinkedIn search results for local export.
* **Data Transmission**: None. Zero data is transmitted to external servers.
* **Data Retention**: Results are stored exclusively in Chrome local storage on the user's machine and can be cleared at any time with the "Clear Results" button.
* **User Authentication**: HireFlow does not collect or store passwords, cookies, or account credentials.

---

## 5. Version History

### Version 1.0.0 (2026-09-30)
* Initial production release.
* Manifest V3 architecture with Vite, React, and TypeScript.
* Progressive post crawler with gentle scroll pacing.
* Layered selector adapter for LinkedIn DOM resilience.
* Robust email extractor with RFC-5322 compliance and bracket stripping.
* Real-time progress updates with stop and reset functionality.
* JSON download and copy to clipboard features.
