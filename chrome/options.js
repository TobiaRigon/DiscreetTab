document.addEventListener('DOMContentLoaded', () => {
  const checkbox = document.getElementById('defaultDiscreet');
  const titleInput = document.getElementById('titleFormat');
  const saveBtn = document.getElementById('saveBtn');

  // Carica opzioni salvate
  chrome.storage.local.get(['defaultDiscreetEnabled', 'titleFormat'], (res) => {
    checkbox.checked = res.defaultDiscreetEnabled || false;
    titleInput.value = res.titleFormat || '[{n}]';
  });

  // Salva
  saveBtn.addEventListener('click', () => {
    chrome.storage.local.set({
      defaultDiscreetEnabled: checkbox.checked,
      titleFormat: titleInput.value || '[{n}]'
    }, () => {
      alert("Impostazioni salvate");
    });
  });
});
