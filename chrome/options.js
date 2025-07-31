document.addEventListener('DOMContentLoaded', () => {
  const checkbox = document.getElementById('defaultDiscreet');
  const titleInput = document.getElementById('titleFormat');
  const saveBtn = document.getElementById('saveBtn');
  const faviconInput = document.getElementById('customFavicon');

  // Carica opzioni salvate
  chrome.storage.local.get(['defaultDiscreetEnabled', 'titleFormat', 'customFavicon'], (res) => {
    checkbox.checked = res.defaultDiscreetEnabled || false;
    titleInput.value = res.titleFormat || 'Tab{n}';
    faviconInput.value = res.customFavicon || '';
  });

  // Salva
  saveBtn.addEventListener('click', () => {
    chrome.storage.local.set({
      defaultDiscreetEnabled: checkbox.checked,
      titleFormat: titleInput.value || 'Tab{n}'
    }, () => {
      alert("Impostazioni salvate");
    });

    chrome.storage.sync.set({
      customFavicon: faviconInput.value.trim()
    });
  });

  document.getElementById('showTitle').addEventListener('change', (e) => {
    chrome.storage.sync.set({ showTitle: e.target.checked });
  });

  chrome.storage.sync.get(['showTitle'], (res) => {
    document.getElementById('showTitle').checked = !!res.showTitle;
  });
});
