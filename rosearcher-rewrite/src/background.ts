
chrome.tabs.onUpdated.addListener((tabId, changeInfo, { url }) => {
    if (changeInfo.status !== 'complete' || !/https:\/\/.+roblox.com\/games/g.test(url)) return;
  
    const target = { tabId };
  
    // Checks if the panel is already injected into the DOM, and if not execute our scripts.
    chrome.scripting.executeScript({ target, func: () => Boolean(document.getElementById('rosearch-panel')) }, async ([{ result }]) => {
      if (result) return;
        
      await chrome.scripting.insertCSS({ target, files: ['styles.css'] });
      chrome.scripting.executeScript({ target, files: ['content.js'] });
    });
  });

  const func = (place: number, id: number) => window.Roblox.GameLauncher.joinGameInstance(place, id);
  chrome.runtime.onMessage.addListener(({ message }, { tab }) => {
    if (tab?.id) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id }, func, args: [message.place, message.id], world: 'MAIN',
        },
      );
    }
  });
  
  