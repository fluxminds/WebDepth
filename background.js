// Background service worker
let techData = null;
const detectedHeaders = new Map(); // tabId -> technologies[]

// Load technology definitions
async function loadTechData() {
    try {
        const response = await fetch(chrome.runtime.getURL('data/technologies.json'));
        techData = await response.json();
    } catch (e) {
        console.error('[WebAnalyst] Failed to load technology data:', e);
    }
}

loadTechData();

// Detect technologies from response headers
function detectFromHeaders(headers) {
    if (!techData) return [];

    const matches = [];

    for (const [name, rules] of Object.entries(techData)) {
        if (!rules.headers) continue;

        for (const [headerName, expectedValue] of Object.entries(rules.headers)) {
            const header = headers.find(h => h.name.toLowerCase() === headerName.toLowerCase());
            if (!header) continue;

            // Check if value matches (empty expectedValue means existence check only)
            if (!expectedValue || header.value.toLowerCase().includes(expectedValue.toLowerCase())) {
                matches.push({ name, categories: rules.categories });
                break;
            }
        }
    }

    return matches;
}

// Monitor response headers for main frame requests
chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (details.type !== 'main_frame' || details.tabId < 0) return;

        const headerTechs = detectFromHeaders(details.responseHeaders || []);
        detectedHeaders.set(details.tabId, headerTechs);
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders']
);

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'analysis_complete' || !sender.tab) return;

    const tabId = sender.tab.id;
    const contentTechs = message.data || [];
    const headerTechs = detectedHeaders.get(tabId) || [];

    // Merge and deduplicate
    const allTechs = [...contentTechs];
    for (const ht of headerTechs) {
        if (!allTechs.find(t => t.name === ht.name)) {
            allTechs.push(ht);
        }
    }

    // Store results
    chrome.storage.local.set({ [`tab_${tabId}`]: allTechs });

    // Update badge
    if (allTechs.length > 0) {
        chrome.action.setBadgeText({ text: String(allTechs.length), tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#58a6ff', tabId });
    } else {
        chrome.action.setBadgeText({ text: '', tabId });
    }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.remove(`tab_${tabId}`);
    detectedHeaders.delete(tabId);
});

// Clean up when tab navigates to new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        chrome.storage.local.remove(`tab_${tabId}`);
        chrome.action.setBadgeText({ text: '', tabId });
    }
});
