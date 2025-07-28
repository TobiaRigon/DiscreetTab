document.addEventListener('DOMContentLoaded', restore);
document.getElementById('save').addEventListener('click', save);

async function getSettings() {
  const local = await chrome.storage.local.get('settings');
  let settings = local.settings || {};
  if (settings.syncSettings) {
    const sync = await chrome.storage.sync.get('settings');
    settings = Object.assign({}, settings, sync.settings || {});
  }
  return Object.assign({
    defaultDiscreet: true,
    titleFormat: 'underscore',
    syncSettings: false
  }, settings);
}

async function restore() {
  const settings = await getSettings();
  document.getElementById('defaultDiscreet').checked = settings.defaultDiscreet;
  document.getElementById('syncSettings').checked = settings.syncSettings;
  document.getElementById('titleFormat').value = settings.titleFormat;
}

async function save() {
  const settings = {
    defaultDiscreet: document.getElementById('defaultDiscreet').checked,
    syncSettings: document.getElementById('syncSettings').checked,
    titleFormat: document.getElementById('titleFormat').value
  };
  await chrome.storage.local.set({ settings });
  if (settings.syncSettings) {
    await chrome.storage.sync.set({ settings });
  } else {
    await chrome.storage.sync.remove('settings');
  }
}
