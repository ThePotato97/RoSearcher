/* eslint-disable no-restricted-globals */

chrome.tabs.onUpdated.addListener((tabId, changeInfo, { url }) => {
  if (!url || changeInfo.status !== 'complete' || !/https:\/\/.+roblox.com\/games/g.test(url)) return;

  const target = { tabId };

  // Checks if the panel is already injected into the DOM, and if not execute our scripts.
  chrome.scripting.executeScript({ target, func: () => Boolean(document.getElementById('rosearch-panel')) }, async ([{ result }]) => {
    if (result) return;

    await chrome.scripting.insertCSS({ target, files: ['styles.css'] });
    chrome.scripting.executeScript({ target, files: ['content.js'] });
  });
});

interface TokenMap {
  [key: number]: string;
}

interface LocalStorage {
  [key: string]: TokenMap;
}

const func = (place: number, id: number) => window.Roblox.GameLauncher.joinGameInstance(place, id);
chrome.runtime.onMessage.addListener((request, sender) => {
  const { message, action } = request;
  const { tab } = sender;
  if (!tab?.id) return
  switch (action) {
    case 'join': {
      const { place, id } = message;
      if (!place || !id) return
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id }, func, args: [place, id], world: 'MAIN',
        },
      );
      break
    }
    case 'saveToken': {
      const { userId, token } = message;
      if (!userId || !token) return
      chrome.storage.local.get("rosearcher-tokens", (result: LocalStorage) => {
        const tokens = result["rosearcher-tokens"] || new Map();
        const tokensMap: Map<string, string> = new Map(Object.entries(tokens));
        tokensMap.set(userId, token);
        chrome.storage.local.set({
          "rosearcher-tokens": Object.fromEntries(Array.from(tokensMap.entries()))
        });
      });
      break
    }
    default: {
      break
    }
  }
});

