// ==UserScript==
// @name         Finanzblick CSV Export
// @namespace    local.finanzblick
// @version      1.1.0
// @description  Export selected finanzblick accounts as individual CSV files
// @match        https://finanzblickx.buhl.de/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  if (window.__finanzblickExporterInstalled) return;
  window.__finanzblickExporterInstalled = true;

  let authToken = null;

  // Only reuse authorization headers from the application's XHR requests.
  // The token is kept in memory, never logged or persisted.
  const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (
      typeof name === 'string' &&
      name.toLowerCase() === 'authorization' &&
      typeof value === 'string' &&
      value.startsWith('Bearer ')
    ) {
      authToken = value;
      updateButton();
    }

    return originalSetHeader.apply(this, arguments);
  };

  function updateButton() {
    const button = document.getElementById('fbx-export-button');
    if (!button) return;
    button.textContent = authToken
      ? 'CSV-Export ✓'
      : 'CSV-Export (Anmeldung abwarten)';
  }

  async function apiGet(path, accept = 'application/json') {
    if (!authToken) {
      throw new Error('Noch kein Authentifizierungstoken erkannt.');
    }

    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        Authorization: authToken,
        Accept: accept
      }
    });

    if (response.status === 401) {
      authToken = null;
      updateButton();
      throw new Error('Sitzung abgelaufen. Bitte finanzblick erneut anmelden.');
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  }

  function makeElement(tag, text, parent) {
    const el = document.createElement(tag);
    if (text !== null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  }

  function inputDate(parent, label, value) {
    const wrapper = makeElement('label', null, parent);
    wrapper.className = 'fbx-field';
    makeElement('span', label, wrapper);
    const input = makeElement('input', null, wrapper);
    input.type = 'date';
    input.value = value;
    return input;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function safeFilename(name) {
    const sanitized = String(name || '')
      .replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 80);
    return sanitized || 'Konto';
  }

  async function openExportDialog() {
    document.getElementById('fbx-export-panel')?.remove();

    const panel = makeElement('div', null, document.body);
    panel.id = 'fbx-export-panel';
    const header = makeElement('div', null, panel);
    header.className = 'fbx-header';
    makeElement('h2', 'Finanzblick CSV-Export', header);
    const close = makeElement('button', '×', header);
    close.type = 'button';
    close.setAttribute('aria-label', 'Exportfenster schließen');
    close.addEventListener('click', () => panel.remove());

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const start = inputDate(panel, 'Von', `${year}-${month}-01`);
    const end = inputDate(
      panel,
      'Bis',
      `${year}-${month}-${String(
        new Date(year, today.getMonth() + 1, 0).getDate()
      ).padStart(2, '0')}`
    );

    makeElement('h3', 'Konten auswählen', panel);
    const accountList = makeElement('div', null, panel);
    accountList.className = 'fbx-accounts';
    const status = makeElement('div', 'Lade Konten ...', panel);
    status.className = 'fbx-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const exportButton = makeElement(
      'button', 'CSV-Dateien herunterladen', panel
    );
    exportButton.type = 'button';
    exportButton.className = 'fbx-submit';
    exportButton.disabled = true;

    let accounts = [];
    try {
      const response = await apiGet('/api/accounts/accountbases');
      accounts = await response.json();
      if (!Array.isArray(accounts)) throw new Error('Unerwartete Kontoliste');
      // The panel might have been closed while the request was in flight.
      if (!panel.isConnected) return;

      accounts.forEach((account, index) => {
        const row = makeElement('label', null, accountList);
        row.className = 'fbx-account';
        const checkbox = makeElement('input', null, row);
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.value = account.id;
        makeElement('span', account.productName || `Konto ${index + 1}`, row);
      });
      status.textContent = `${accounts.length} Konten gefunden`;
      exportButton.disabled = accounts.length === 0;
    } catch (error) {
      status.textContent = `Fehler: ${error.message}`;
    }

    exportButton.addEventListener('click', async () => {
      const selected = [...accountList.querySelectorAll(
        'input[type="checkbox"]:checked'
      )];
      if (!selected.length) {
        status.textContent = 'Bitte mindestens ein Konto auswählen.';
        return;
      }
      if (
        !start.validity.valid || !end.validity.valid ||
        !start.value || !end.value || start.value > end.value
      ) {
        status.textContent = 'Ungültiger Zeitraum.';
        return;
      }

      exportButton.disabled = true;
      let success = 0;
      let errors = 0;

      // Use the account's position in the full list as a stable, human-readable
      // discriminator. Even identical productName values produce different files.
      for (const checkbox of selected) {
        const index = accounts.findIndex(a => a.id === checkbox.value);
        if (index < 0) continue;
        const account = accounts[index];
        const name = account.productName || `Konto ${index + 1}`;
        status.textContent =
          `Exportiere ${success + errors + 1}/${selected.length}: ${name}`;

        const params = new URLSearchParams({
          StartDate: `${start.value}T00:00:00.000Z`,
          EndDate: `${end.value}T23:59:59.000Z`
        });
        try {
          const response = await apiGet(
            `/api/importexport/Export/csv/${encodeURIComponent(account.id)}?${params}`,
            'text/csv'
          );
          const blob = await response.blob();
          const accountNumber = String(index + 1).padStart(2, '0');
          const filename =
            `${safeFilename(name)}_${accountNumber}_${start.value}_${end.value}.csv`;
          downloadBlob(blob, filename);
          success++;
        } catch (error) {
          errors++;
          // Do not log API response bodies or credential-bearing requests.
          console.error('[Finanzblick Export]', safeFilename(name), error.message);
          if (!authToken) {
            status.textContent =
              `Sitzung abgelaufen. ${success} Downloads gestartet.`;
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (authToken) {
        status.textContent =
          `${success} Downloads gestartet, ${errors} Fehler.`;
      }
      exportButton.disabled = false;
    });
  }

  function initialize() {
    if (document.getElementById('fbx-export-button')) return;
    const css = document.createElement('style');
    css.textContent = `
      #fbx-export-button {
        position: fixed; right: 24px; bottom: 24px;
        z-index: 2147483646; padding: 12px 18px;
        border: none; border-radius: 9px; background: #2563eb;
        color: white; font: 600 14px system-ui; cursor: pointer;
        box-shadow: 0 4px 16px #0003;
      }
      #fbx-export-panel {
        position: fixed; right: 24px; bottom: 80px;
        z-index: 2147483647;
        width: min(350px, calc(100vw - 48px)); max-height: 80vh;
        overflow: auto; box-sizing: border-box; padding: 20px;
        background: #fff; color: #202020; border-radius: 12px;
        box-shadow: 0 8px 35px #0004; font: 14px system-ui;
      }
      #fbx-export-panel .fbx-header {
        display: flex; justify-content: space-between; align-items: center;
      }
      #fbx-export-panel h2 { font-size: 17px; margin: 0 0 15px; }
      #fbx-export-panel h3 { font-size: 14px; margin: 16px 0 8px; }
      #fbx-export-panel button { cursor: pointer; }
      #fbx-export-panel .fbx-header button {
        border: none; background: transparent; color: #333; font-size: 24px;
      }
      #fbx-export-panel .fbx-field {
        display: flex; flex-direction: column; margin-bottom: 10px; gap: 5px;
      }
      #fbx-export-panel input[type="date"] {
        padding: 8px; border: 1px solid #bbb; border-radius: 6px;
      }
      #fbx-export-panel .fbx-account {
        display: flex; align-items: center; gap: 9px; padding: 7px 0;
      }
      #fbx-export-panel .fbx-status {
        margin: 14px 0; color: #555; font-size: 12px;
      }
      #fbx-export-panel .fbx-submit {
        width: 100%; padding: 11px; background: #2563eb;
        color: white; border: none; border-radius: 7px; font-weight: 600;
      }
      #fbx-export-panel .fbx-submit:disabled {
        opacity: .5; cursor: not-allowed;
      }
    `;
    (document.head || document.documentElement).appendChild(css);
    const button = makeElement('button', 'CSV-Export', document.body);
    button.id = 'fbx-export-button';
    button.type = 'button';
    button.addEventListener('click', openExportDialog);
    updateButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
