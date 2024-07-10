chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: hideTabDetails
    });
  });
  
  function hideTabDetails() {
    // Nasconde la favicon
    var link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'icon';
    link.href = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABrklEQVQ4T6WTv0pCURSH7///ZjdNZCAeghgIg0jQaAg2hB+gUOiDgD2lA0KgqiBGqLSwWKggqCBgoIUWzscjZn3XOdUwdxdnZt93zf9+xv+aaCT+4WfZf7ZCSu23C5zm0j7/jZwHX5l2/d90rpU67TYh33nAGhYc6DYEr5YquFbrM1h5sJXyUOBqRtGnfb4ay+QKZB3qZkDYBN/Ld9rtd8ftEd1xXM7VTRFVFdXLLe/9MbC2v3KXGrvV/BNiL0iImFwADgZwtWWPZRWdgoEr8MwDLyI8isXFPZpDAS/g5ACm29eHvI19u0fOPQuG57aWvDGoPCT0rRhRiULZBVwT/DsRQieZ5GVuXeqdVfgVmBqIYXjkbrAT8XpBM9TtgnUTbES0QdJquklOwRWp1sdEDMkoQErQAU4miarNZ2G4DYOBj3Fg+ALa7Va0N5X6G2Z0auCj4ABc5mCddVlkN3N36TA7dM4FGfC9bG3FZpjcU0+CQ7CBk2OYgfwMEJ5c11tznnI4OHc4/4IizS6wDdM9Xe0a3zmNes07mOBOAnlJ72F2AAAAAElFTkSuQmCC';
    document.getElementsByTagName('head')[0].appendChild(link);
  
    // Nasconde il titolo della scheda
    document.title = '_';
  }
  