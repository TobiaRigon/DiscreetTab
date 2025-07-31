document.addEventListener('DOMContentLoaded', () => {
  const checkbox = document.getElementById('defaultDiscreet');
  const titleInput = document.getElementById('titleFormat');
  const saveBtn = document.getElementById('saveBtn');
  const faviconInput = document.getElementById('customFavicon');
  const showTitleCheckbox = document.getElementById('showTitle');
  const customTitleContainer = titleInput.parentElement; // Assicurati che sia il container giusto

  // Aggiungi la checkbox per custom icon
  let enableCustomFaviconCheckbox = document.getElementById('enableCustomFavicon');
  let customFaviconContainer = faviconInput.parentElement;
  if (!enableCustomFaviconCheckbox) {
    enableCustomFaviconCheckbox = document.createElement('input');
    enableCustomFaviconCheckbox.type = 'checkbox';
    enableCustomFaviconCheckbox.id = 'enableCustomFavicon';
    enableCustomFaviconCheckbox.style.marginRight = '6px';

    const label = document.createElement('label');
    label.appendChild(enableCustomFaviconCheckbox);
    label.appendChild(document.createTextNode('Enable custom favicon'));
    customFaviconContainer.parentElement.insertBefore(label, customFaviconContainer);
  }

  // Carica opzioni salvate
  chrome.storage.sync.get([
    'defaultDiscreetEnabled',
    'titleFormat',
    'customFavicon',
    'showTitle',
    'enableCustomFavicon'
  ], (res) => {
    checkbox.checked = res.defaultDiscreetEnabled || false;
    titleInput.value = res.titleFormat || 'Tab{n}';
    faviconInput.value = res.customFavicon || '';
    showTitleCheckbox.checked = !!res.showTitle;
    enableCustomFaviconCheckbox.checked = !!res.enableCustomFavicon;

    customTitleContainer.style.display = showTitleCheckbox.checked ? 'none' : '';
    customFaviconContainer.style.display = enableCustomFaviconCheckbox.checked ? '' : 'none';
  });

  showTitleCheckbox.addEventListener('change', (e) => {
    customTitleContainer.style.display = e.target.checked ? 'none' : '';
    chrome.storage.sync.set({ showTitle: e.target.checked });
  });

  enableCustomFaviconCheckbox.addEventListener('change', (e) => {
    customFaviconContainer.style.display = e.target.checked ? '' : 'none';
    chrome.storage.sync.set({ enableCustomFavicon: e.target.checked });
  });

  saveBtn.addEventListener('click', () => {
    chrome.storage.sync.set({
      defaultDiscreetEnabled: checkbox.checked,
      titleFormat: titleInput.value || 'Tab{n}',
      customFavicon: faviconInput.value.trim(),
      showTitle: showTitleCheckbox.checked,
      enableCustomFavicon: enableCustomFaviconCheckbox.checked
    }, () => {
      alert("Impostazioni salvate");
    });
  });
});
