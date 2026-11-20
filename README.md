# Finanzblick CSV Export (Userscript)

An **unofficial userscript** for [finanzblick](https://finanzblickx.buhl.de/) that exports transactions from multiple accounts for a custom date range as **separate CSV files**, without having to open and export each account individually in the web interface.

> **Disclaimer:** This is a community project and is **not** developed, supported, or officially endorsed by Buhl Data Service GmbH. It uses undocumented web API endpoints that may change at any time.

## Features

- Automatically discovers accounts through the finanzblick web application.
- Lets you select individual accounts or all accounts.
- Provides start and end date fields (default: the current calendar month).
- Downloads **one CSV file per selected account**.
- Builds filenames from the account name, a **two-digit account index**, and the date range, for example `Main_2026-11-01_2026-11-30.csv`. This avoids filename collisions when accounts have identical names.
- Does not require a password or account ID to be hardcoded in the script.

## Requirements

- An active finanzblick account and access to the web application at `https://finanzblickx.buhl.de/`.
- A userscript manager that supports `@run-at document-start` and **execution in the page context** (`@inject-into page`).
- Tested setup: **Safari on macOS** with the free **Userscripts** extension.
- Permission to download files (including multiple files, if prompted) from `finanzblickx.buhl.de`.

## Installation (Safari)

1. Install [Userscripts for Safari](https://github.com/quoid/userscripts) and enable it under **Safari → Settings → Extensions**.
2. Allow the extension to access `finanzblickx.buhl.de`.
3. Open the scripts directory configured in Userscripts and copy [`finanzblick-export.user.js`](finanzblick-export.user.js) into it.
4. Confirm that **Finanzblick CSV Export** is enabled in the Userscripts extension.
5. Open `https://finanzblickx.buhl.de/`, sign in, and reload the page.
6. Once **CSV-Export ✓** appears, the exporter is ready. If the button still says it is waiting for authentication, switch to another account within finanzblick to trigger a regular API request.

Other browsers and userscript managers have not been systematically tested with this version. Support for `@inject-into page` must be verified separately.

## Usage

1. Sign in to finanzblick and click **CSV-Export ✓**.
2. Choose the **From** and **To** dates (the labels in the script's interface may be in German).
3. Select the accounts to export (all are selected by default).
4. Click **Download CSV files** (shown as **CSV-Dateien herunterladen** in the current script).
5. If Safari prompts you, allow downloads for the website.
6. Check your Downloads folder for the resulting files.

The **“Downloads started”** status means that the download actions were triggered; it does **not** guarantee that the browser successfully saved every file.

## Privacy and security

- The `@match` rule limits the script to **`https://finanzblickx.buhl.de/*`**.
- The script detects the `Authorization: Bearer ...` header on regular `XMLHttpRequest` calls and retains the token **only in the current tab's memory**. It is **not written to Local Storage, IndexedDB, or a file**, and is not logged to the console.
- API requests go only to the **same finanzblick domain**. The returned CSV data is made available through local browser downloads. The script contains **no transmission to third-party or custom analytics servers**.
- The script must run in the **page context** to observe request headers. This gives it broad access to the active finanzblick page.
- Reloading the page clears the captured token. A new token can be captured when the application makes another regular API request. An expired token may result in HTTP 401; signing in again or triggering another authenticated API request may be necessary.

## Technical notes and limitations

- Internal API endpoints used:
  - `GET /api/accounts/accountbases` — account list
  - `GET /api/importexport/Export/csv/{accountId}?StartDate=...&EndDate=...` — CSV export
- Date boundaries follow the tested web export format: `T00:00:00.000Z` for the start and `T23:59:59.000Z` for the end. **For transactions near midnight or during daylight saving time changes, compare the output with a manual export.**
- Browsers may block multiple automatic downloads. You may need to explicitly allow them for the website in Safari.
- finanzblick generates the CSV content and columns, which may change without notice.
- Account names may be identical, so each filename includes an index based on the account's position in the returned account list. This index is **not** a bank account number.
- No third-party JavaScript library or separate server is required.

## License

MIT — see [LICENSE](LICENSE).
