// === Costanti ===
const STORAGE_KEY = 'discreet_domains';

// === 1. Gestione errori globale ===
function safeAsync(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      console.error('DiscreetTab error:', e);
    }
  };
}

// === 2. Debounce/throttle per onCompleted ===
let lastNav = {};
function throttleNav(tabId, url, ms = 500) {
  const key = `${tabId}:${url}`;
  const now = Date.now();
  if (lastNav[key] && now - lastNav[key] < ms) return false;
  lastNav[key] = now;
  return true;
}

// === 3. Helpers ===
function ensureArray(arr) {
  return Array.isArray(arr) ? arr : [];
}
function ensureObject(obj) {
  return obj && typeof obj === 'object' ? obj : {};
}
function formatTitle(template, number) {
  return template.replaceAll('{n}', number.toString());
}

// === 4. Gestione dominio ===
function getDomainData(data, domain) {
  return Array.isArray(data[domain]) ? data[domain] : [];
}
function setDomainData(data, domain, arr) {
  data[domain] = arr;
}

// === 5. Gestione favicon ===
async function getFaviconDataUrl() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['customFavicon'], (res) => {
      if (res.customFavicon && res.customFavicon.trim().startsWith('http')) {
        resolve(res.customFavicon.trim());
      } else {
        // Default trasparente
        resolve("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgwJ/lr6pNwAAAABJRU5ErkJggg==");
      }
    });
  });
}

// === 6. Storage ===
function getStoredData() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY], (res) => {
      resolve(ensureObject(res[STORAGE_KEY]));
    });
  });
}

function getStoredOptions() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['titleFormat', 'defaultDiscreetEnabled'], (res) => {
      resolve({
        titleFormat: res.titleFormat || 'Tab{n}',
        defaultDiscreetEnabled: !!res.defaultDiscreetEnabled
      });
    });
  });
}

async function batchSet(obj) {
  return new Promise(resolve => chrome.storage.sync.set(obj, resolve));
}

function getNextAvailableIndex() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['usedIndexes', 'freeIndexes'], (res) => {
      const used = ensureArray(res.usedIndexes).filter(Number.isInteger);
      const free = ensureArray(res.freeIndexes).filter(Number.isInteger);

      if (free.length > 0) {
        const next = free.sort((a, b) => a - b).shift();
        const remaining = free.filter(i => i !== next);
        chrome.storage.sync.set({ freeIndexes: remaining });
        resolve(next);
      } else {
        const max = used.length > 0 ? Math.max(...used) : 0;
        resolve(max + 1);
      }
    });
  });
}

function reserveIndex(index) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['usedIndexes'], (res) => {
      const used = new Set(ensureArray(res.usedIndexes).filter(Number.isInteger));
      used.add(index);
      chrome.storage.sync.set({ usedIndexes: Array.from(used) }, resolve);
    });
  });
}

function releaseIndex(index) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['usedIndexes', 'freeIndexes'], (res) => {
      const used = new Set(ensureArray(res.usedIndexes).filter(Number.isInteger));
      const free = new Set(ensureArray(res.freeIndexes).filter(Number.isInteger));
      used.delete(index);
      free.add(index);
      chrome.storage.sync.set({
        usedIndexes: Array.from(used),
        freeIndexes: Array.from(free)
      }, resolve);
    });
  });
}

// === 7. Utility ===
function isUnsupportedUrl(url) {
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("about:") ||
    url.startsWith("file://")
  );
}

// === 8. Cleanup dati all'avvio ===
chrome.runtime.onStartup.addListener(() => {
  cleanupIndexes();
});
async function cleanupIndexes() {
  try {
    const { usedIndexes, freeIndexes } = await new Promise(resolve =>
      chrome.storage.local.get(['usedIndexes', 'freeIndexes'], resolve)
    );
    const used = ensureArray(usedIndexes).filter(Number.isInteger);
    const free = ensureArray(freeIndexes).filter(i => !used.includes(i) && Number.isInteger(i));
    await chrome.storage.local.set({ usedIndexes: used, freeIndexes: free });
  } catch (e) {
    console.error('Cleanup error:', e);
  }
}

// === 9. Iniezione script discreto ===
async function injectScript(tabId, number) {
  const options = await getStoredOptions();
  const showTitle = await new Promise(resolve =>
    chrome.storage.sync.get(['showTitle'], res => resolve(!!res.showTitle))
  );
  const title = formatTitle(options.titleFormat, number);
  const favicon = await getFaviconDataUrl();

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (customTitle, faviconUrl, showTitle) => {
      function setDiscreet() {
        if (!document.head) return;
        document.querySelectorAll("link[rel*='icon']").forEach(e => e.remove());
        const link = document.createElement("link");
        link.rel = "icon";
        link.type = "image/x-icon";
        link.href = faviconUrl;
        document.head.appendChild(link);
        if (!showTitle) {
          document.title = customTitle;
        }
        // Se showTitle è true, NON modificare il titolo
      }
      setDiscreet();

      if (window.__discreetTabInterval) clearInterval(window.__discreetTabInterval);
      window.__discreetTabInterval = setInterval(() => {
        if (!showTitle && document.title !== customTitle) setDiscreet();
        if (showTitle) {
          // Solo controllo favicon
          const icons = Array.from(document.querySelectorAll("link[rel*='icon']"));
          const found = icons.some(l => l.href === faviconUrl);
          if (!found) setDiscreet();
        } else {
          // Controllo sia titolo che favicon
          if (document.title !== customTitle) setDiscreet();
          const icons = Array.from(document.querySelectorAll("link[rel*='icon']"));
          const found = icons.some(l => l.href === faviconUrl);
          if (!found) setDiscreet();
        }
      }, 2000);
    },
    args: [title, favicon, showTitle]
  });
}

// === 10. Event listeners principali ===

// Installazione e setup iniziale
chrome.runtime.onInstalled.addListener(safeAsync(async () => {
  const res = await new Promise(resolve => chrome.storage.local.get([STORAGE_KEY, 'usedIndexes', 'freeIndexes'], resolve));
  if (!res[STORAGE_KEY]) await batchSet({ [STORAGE_KEY]: {} });
  if (!Array.isArray(res.usedIndexes)) await batchSet({ usedIndexes: [] });
  if (!Array.isArray(res.freeIndexes)) await batchSet({ freeIndexes: [] });

  chrome.contextMenus.create({
    id: "open_settings",
    title: "Impostazioni DiscreetTab",
    contexts: ["action"]
  });
}));

// Click sull'icona dell'estensione
chrome.action.onClicked.addListener(safeAsync(async (tab) => {
  if (!tab || !tab.url || !tab.id || isUnsupportedUrl(tab.url)) return;

  const url = new URL(tab.url);
  const domain = url.hostname;
  const tabId = tab.id;
  const data = await getStoredData();

  let domainArr = getDomainData(data, domain);

  if (domainArr.length > 0) {
    // Rimuovi tutti gli indici associati a questo dominio
    for (const { index, originalTitle } of domainArr) {
      await releaseIndex(index);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (title) => {
          if (document.head) {
            document.title = title;
            document.querySelectorAll("link[rel*='icon']").forEach(e => e.remove());
            const link = document.createElement("link");
            link.rel = "icon";
            link.href = "/favicon.ico";
            document.head.appendChild(link);
          }
          // Disattiva eventuali intervalli discreti
          if (window.__discreetTabInterval) {
            clearInterval(window.__discreetTabInterval);
            window.__discreetTabInterval = null;
          }
        },
        args: [originalTitle]
      });
    }
    setDomainData(data, domain, []);
    await batchSet({ [STORAGE_KEY]: data });
  } else {
    const index = await getNextAvailableIndex();
    await reserveIndex(index);
    domainArr.push({
      index,
      originalTitle: tab.title || ''
    });
    setDomainData(data, domain, domainArr);
    await batchSet({ [STORAGE_KEY]: data });
    await injectScript(tabId, index);
  }
}));

// Navigazione completata
chrome.webNavigation.onCompleted.addListener(safeAsync(async ({ tabId, frameId, url }) => {
  if (frameId !== 0 || isUnsupportedUrl(url)) return;
  if (!throttleNav(tabId, url)) return;

  try {
    const domain = new URL(url).hostname;
    const [data, options] = await Promise.all([
      getStoredData(),
      getStoredOptions()
    ]);
    let domainArr = getDomainData(data, domain);

    if (domainArr.length > 0) {
      // Applica solo al primo index (o puoi iterare su tutti)
      await injectScript(tabId, domainArr[0].index);
    } else if (options.defaultDiscreetEnabled) {
      const index = await getNextAvailableIndex();
      await reserveIndex(index);
      domainArr.push({ index, originalTitle: '' });
      setDomainData(data, domain, domainArr);
      await batchSet({ [STORAGE_KEY]: data });
      await injectScript(tabId, index);
    }
  } catch (e) {
    // URL malformato o non gestibile
  }
}));

// Tab creato
chrome.tabs.onCreated.addListener(safeAsync(async (tab) => {
  if (!tab || !tab.id || !tab.url || isUnsupportedUrl(tab.url)) return;

  const options = await getStoredOptions();
  if (!options.defaultDiscreetEnabled) return;

  const url = new URL(tab.url);
  const domain = url.hostname;
  const data = await getStoredData();
  let domainArr = getDomainData(data, domain);

  if (domainArr.length === 0) {
    const index = await getNextAvailableIndex();
    await reserveIndex(index);
    domainArr.push({
      index,
      originalTitle: tab.title || ''
    });
    setDomainData(data, domain, domainArr);
    await batchSet({ [STORAGE_KEY]: data });
    await injectScript(tab.id, index);
  }
}));

// Quando una tab torna "complete" dopo essere stata sospesa
chrome.tabs.onUpdated.addListener(safeAsync(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url || isUnsupportedUrl(tab.url)) return;
  const domain = new URL(tab.url).hostname;
  const data = await getStoredData();
  let domainArr = getDomainData(data, domain);
  if (domainArr.length > 0) {
    await injectScript(tabId, domainArr[0].index);
  }
}));

// Context menu
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "open_settings") {
    chrome.runtime.openOptionsPage();
  }
});

// Comandi da tastiera
chrome.commands.onCommand.addListener(safeAsync(async (command, tab) => {
  if (command !== "toggle-discreet") return;

  // Ottieni la tab attiva
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.url || isUnsupportedUrl(activeTab.url)) return;

  const url = new URL(activeTab.url);
  const domain = url.hostname;
  const tabId = activeTab.id;
  const data = await getStoredData();
  let domainArr = getDomainData(data, domain);

  if (domainArr.length > 0) {
    // Disattiva modalità discreta
    for (const { index, originalTitle } of domainArr) {
      await releaseIndex(index);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (title) => {
          if (document.head) {
            document.title = title;
            document.querySelectorAll("link[rel*='icon']").forEach(e => e.remove());
            const link = document.createElement("link");
            link.rel = "icon";
            link.href = "/favicon.ico";
            document.head.appendChild(link);
          }
          if (window.__discreetTabInterval) {
            clearInterval(window.__discreetTabInterval);
            window.__discreetTabInterval = null;
          }
        },
        args: [originalTitle]
      });
    }
    setDomainData(data, domain, []);
    await batchSet({ [STORAGE_KEY]: data });
  } else {
    // Attiva modalità discreta
    const index = await getNextAvailableIndex();
    await reserveIndex(index);
    domainArr.push({
      index,
      originalTitle: activeTab.title || ''
    });
    setDomainData(data, domain, domainArr);
    await batchSet({ [STORAGE_KEY]: data });
    await injectScript(tabId, index);
  }
}));