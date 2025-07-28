const STORAGE_KEY = 'discreet_domains';

// Inizializza lo storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    if (!res[STORAGE_KEY]) {
      chrome.storage.local.set({ [STORAGE_KEY]: {} });
    }
  });
});

// Click sull'icona dell'estensione
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.url || !tab.id || !tab.title || isUnsupportedUrl(tab.url)) return;

  const url = new URL(tab.url);
  const domain = url.hostname;
  const tabId = tab.id;
  const data = await getStoredData();

  if (data[domain]) {
    // Rimuovi dominio dalla lista
    const originalTitle = data[domain].originalTitle || '';
    delete data[domain];
    await chrome.storage.local.set({ [STORAGE_KEY]: data });

    chrome.scripting.executeScript({
      target: { tabId },
      func: (title) => {
        if (document.head) {
          document.title = title;

          const link = document.createElement("link");
          link.rel = "icon";
          link.href = "/favicon.ico";
          document.head.appendChild(link);
        }
      },
      args: [originalTitle]
    });

  } else {
    // Aggiungi dominio
    const index = Object.keys(data).length + 1;
    data[domain] = {
      index,
      originalTitle: tab.title
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: data });

    injectScript(tabId, index);
  }
});

// Su completamento caricamento pagina
chrome.webNavigation.onCompleted.addListener(async ({ tabId, frameId, url }) => {
  if (frameId !== 0 || isUnsupportedUrl(url)) return;

  try {
    const domain = new URL(url).hostname;
    const data = await getStoredData();
    if (data[domain]) {
      injectScript(tabId, data[domain].index);
    }
  } catch (e) {
    // URL non valido
  }
}, { url: [{ schemes: ['http', 'https'] }] });

// Helpers
function getStoredData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      resolve(res[STORAGE_KEY] || {});
    });
  });
}

function injectScript(tabId, number) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (count) => {
      if (!document.head) return;

      document.querySelectorAll("link[rel*='icon']").forEach(e => e.remove());

      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/x-icon";
      link.href = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgwJ/lr6pNwAAAABJRU5ErkJggg==";
      document.head.appendChild(link);

      document.title = `[${count}]`;
    },
    args: [number]
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
