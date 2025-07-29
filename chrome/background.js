const STORAGE_KEY = 'discreet_domains';

// Inizializzazione storage al primo avvio
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    if (!res[STORAGE_KEY]) {
      chrome.storage.local.set({ [STORAGE_KEY]: {} });
    }
  });

  chrome.storage.local.get(['usedIndexes', 'freeIndexes'], (res) => {
    if (!Array.isArray(res.usedIndexes)) {
      chrome.storage.local.set({ usedIndexes: [] });
    }
    if (!Array.isArray(res.freeIndexes)) {
      chrome.storage.local.set({ freeIndexes: [] });
    }
  });

  chrome.contextMenus.create({
    id: "open_settings",
    title: "Impostazioni DiscreetTab",
    contexts: ["action"]
  });
});

// Click sull'icona dell'estensione
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.url || !tab.id || isUnsupportedUrl(tab.url)) return;

  const url = new URL(tab.url);
  const domain = url.hostname;
  const tabId = tab.id;
  const data = await getStoredData();

  if (data[domain]) {
    const { index, originalTitle } = data[domain];
    delete data[domain];
    await releaseIndex(index);
    await chrome.storage.local.set({ [STORAGE_KEY]: data });

    await chrome.scripting.executeScript({
      target: { tabId },
      func: (title) => {
        if (document.head) {
          document.title = title;
          // Ripristina favicon default
          document.querySelectorAll("link[rel*='icon']").forEach(e => e.remove());
          const link = document.createElement("link");
          link.rel = "icon";
          link.href = "/favicon.ico";
          document.head.appendChild(link);
        }
      },
      args: [originalTitle]
    });

  } else {
    const index = await getNextAvailableIndex();
    await reserveIndex(index);

    data[domain] = {
      index,
      originalTitle: tab.title || ''
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: data });

    await injectScript(tabId, index);
  }
});

// Gestione caricamento pagine
chrome.webNavigation.onCompleted.addListener(async ({ tabId, frameId, url }) => {
  if (frameId !== 0 || isUnsupportedUrl(url)) return;

  try {
    const domain = new URL(url).hostname;
    const [data, options] = await Promise.all([
      getStoredData(),
      getStoredOptions()
    ]);

    if (data[domain]) {
      await injectScript(tabId, data[domain].index);
    } else if (options.defaultDiscreetEnabled) {
      const index = await getNextAvailableIndex();
      await reserveIndex(index);
      data[domain] = { index, originalTitle: '' };
      await chrome.storage.local.set({ [STORAGE_KEY]: data });
      await injectScript(tabId, index);
    }

  } catch (e) {
    // URL malformato o non gestibile
  }
});

// Nuove tab: applica modalità discreta se attiva
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab || !tab.id || !tab.url || isUnsupportedUrl(tab.url)) return;

  const options = await getStoredOptions();
  if (!options.defaultDiscreetEnabled) return;

  const url = new URL(tab.url);
  const domain = url.hostname;
  const data = await getStoredData();

  if (!data[domain]) {
    const index = await getNextAvailableIndex();
    await reserveIndex(index);

    data[domain] = {
      index,
      originalTitle: tab.title || ''
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: data });

    await injectScript(tab.id, index);
  }
});

// Context menu per aprire la pagina delle opzioni
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "open_settings") {
    chrome.runtime.openOptionsPage();
  }
});

// Helpers
function getStoredData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      resolve(res[STORAGE_KEY] || {});
    });
  });
}

function getStoredOptions() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['titleFormat', 'defaultDiscreetEnabled'], (res) => {
      resolve({
        titleFormat: res.titleFormat || '[{n}]',
        defaultDiscreetEnabled: !!res.defaultDiscreetEnabled
      });
    });
  });
}

function formatTitle(template, number) {
  return template.replaceAll('{n}', number.toString());
}

async function injectScript(tabId, number) {
  const options = await getStoredOptions();
  const title = formatTitle(options.titleFormat, number);

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (customTitle) => {
      if (!document.head) return;
      document.querySelectorAll("link[rel*='icon']").forEach(e => e.remove());
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/x-icon";
      link.href = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgwJ/lr6pNwAAAABJRU5ErkJggg==";
      document.head.appendChild(link);
      document.title = customTitle;
    },
    args: [title]
  });
}

function isUnsupportedUrl(url) {
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("about:") ||
    url.startsWith("file://")
  );
}

// Gestione degli indici
function getNextAvailableIndex() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['usedIndexes', 'freeIndexes'], (res) => {
      const used = res.usedIndexes || [];
      const free = res.freeIndexes || [];

      if (free.length > 0) {
        const next = free.sort((a, b) => a - b).shift();
        const remaining = free.filter(i => i !== next);
        chrome.storage.local.set({ freeIndexes: remaining });
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
    chrome.storage.local.get(['usedIndexes'], (res) => {
      const used = new Set(res.usedIndexes || []);
      used.add(index);
      chrome.storage.local.set({ usedIndexes: Array.from(used) }, resolve);
    });
  });
}

function releaseIndex(index) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['usedIndexes', 'freeIndexes'], (res) => {
      const used = new Set(res.usedIndexes || []);
      const free = new Set(res.freeIndexes || []);
      used.delete(index);
      free.add(index);
      chrome.storage.local.set({
        usedIndexes: Array.from(used),
        freeIndexes: Array.from(free)
      }, resolve);
    });
  });
}