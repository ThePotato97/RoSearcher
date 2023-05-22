/* eslint-disable no-restricted-globals */

chrome.tabs.onUpdated.addListener((tabId, changeInfo, { url }) => {
    if (
        !url ||
        changeInfo.status !== 'complete' ||
        !/https:\/\/.+roblox.com\/games/g.test(url)
    )
        return;

    const target = { tabId };

    // Checks if the panel is already injected into the DOM, and if not execute our scripts.
    chrome.scripting.executeScript(
        {
            target,
            func: () => Boolean(document.getElementById('rosearch-panel')),
        },
        async ([{ result }]) => {
            if (result) return;

            await chrome.scripting.insertCSS({ target, files: ['styles.css'] });
            chrome.scripting.executeScript({ target, files: ['content.js'] });
        }
    );
});

interface TokenMap {
    [key: number]: string;
}

interface LocalStorage {
    [key: string]: TokenMap;
}

const func = (place: number, id: number) =>
    window.Roblox.GameLauncher.joinGameInstance(place, id);

const joinGameInstance = (tabId: number, placeId: number, gameId: number) => {
    chrome.scripting.executeScript({
        target: { tabId },
        func,
        args: [placeId, gameId],
        world: 'MAIN',
    });
};

const saveToken = (userId: string, token: string) => {
    chrome.storage.local.get('rosearcher-tokens', (result: LocalStorage) => {
        const tokens = result['rosearcher-tokens'] || new Map();
        const tokensMap: Map<string, string> = new Map(Object.entries(tokens));
        tokensMap.set(userId, token);
        chrome.storage.local.set({
            'rosearcher-tokens': Object.fromEntries(
                Array.from(tokensMap.entries())
            ),
        });
    });
};

chrome.runtime.onMessage.addListener((request, sender) => {
    const { message, action } = request;
    const { tab } = sender;
    const tabId = tab?.id;
    if (!tabId) return;
    switch (action) {
        case 'join': {
            const { place, id } = message;
            if (!place || !id) return;
            joinGameInstance(tabId, place, id);
            break;
        }
        case 'saveToken': {
            const { userId, token } = message;
            if (!userId || !token) return;
            saveToken(userId, token);
            break;
        }
        default: {
            break;
        }
    }
});
