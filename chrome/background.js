// Background service worker for DiscreetTab
// Gestisce lo stato "discreto" per ogni tab e applica le preferenze utente.

const DEFAULT_SETTINGS = {
  defaultDiscreet: true,
  titleFormat: 'underscore', // 'incremental' | 'numeric' | 'underscore'
  syncSettings: false
};

let settings = Object.assign({}, DEFAULT_SETTINGS);
let discreetTabs = []; // mantiene l'ordine delle tab in modalità discreta

function getStorageArea() {
  return settings.syncSettings ? chrome.storage.sync : chrome.storage.local;
}

async function loadSettings() {
  const local = await chrome.storage.local.get('settings');
  Object.assign(settings, DEFAULT_SETTINGS, local.settings || {});
  if (settings.syncSettings) {
    const sync = await chrome.storage.sync.get('settings');
    Object.assign(settings, sync.settings || {});
  }
}

async function saveSettings() {
  await chrome.storage.local.set({ settings });
  if (settings.syncSettings) {
    await chrome.storage.sync.set({ settings });
  } else {
    await chrome.storage.sync.remove('settings');
  }
}

function buildTitle(index) {
  switch (settings.titleFormat) {
    case 'incremental':
      return index === 1 ? 'Tab' : `Tab (${index - 1})`;
    case 'numeric':
      return String(index);
    default:
      return '_';
  }
}

function updateTitles() {
  discreetTabs.forEach((tabId, i) => {
    const title = buildTitle(i + 1);
    chrome.scripting.executeScript({
      target: { tabId },
      func: applyDiscreet,
      args: [title]
    });
  });
}

function applyDiscreet(title) {
  document.title = title;
  const links = document.querySelectorAll("link[rel*='icon']");
  links.forEach(l => l.remove());
  const blank = document.createElement('link');
  blank.rel = 'icon';
  blank.href = 'data:image/png;base64,';
  document.head.appendChild(blank);
}

async function setTabDiscreet(tabId, enable) {
  if (enable) {
    if (!discreetTabs.includes(tabId)) {
      discreetTabs.push(tabId);
    }
  } else {
    discreetTabs = discreetTabs.filter(id => id !== tabId);
  }
  if (enable) {
    chrome.sessions.setTabValue(tabId, 'discreet', true);
  } else {
    chrome.sessions.removeTabValue(tabId, 'discreet');
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => { location.reload(); }
    });
  }
  updateTitles();
}

async function isTabDiscreet(tabId) {
  return new Promise(resolve => {
    chrome.sessions.getTabValue(tabId, 'discreet', value => {
      resolve(!!value);
    });
  });
}

chrome.runtime.onInstalled.addListener(loadSettings);
chrome.runtime.onStartup.addListener(loadSettings);

chrome.storage.onChanged.addListener((changes, area) => {
  if (changes.settings) {
    Object.assign(settings, changes.settings.newValue);
    updateTitles();
  }
});

chrome.tabs.onCreated.addListener(async tab => {
  await loadSettings();
  if (settings.defaultDiscreet) {
    await setTabDiscreet(tab.id, true);
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  discreetTabs = discreetTabs.filter(id => id !== tabId);
  updateTitles();
});

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status === 'complete') {
    const discreet = await isTabDiscreet(tabId);
    if (discreet) {
      const index = discreetTabs.indexOf(tabId);
      const title = buildTitle(index + 1);
      chrome.scripting.executeScript({ target: { tabId }, func: applyDiscreet, args: [title] });
    }
  }
});

chrome.action.onClicked.addListener(async tab => {
  const discreet = await isTabDiscreet(tab.id);
  await setTabDiscreet(tab.id, !discreet);
});

chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (discreetTabs.includes(details.tabId)) {
      return { cancel: true };
    }
  },
  { urls: ['*://*/favicon.ico*'], types: ['image'] },
  ['blocking']
);

