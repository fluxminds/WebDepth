document.addEventListener('DOMContentLoaded', async () => {
    const loadingView = document.getElementById('loading');
    const resultsView = document.getElementById('results');
    const emptyView = document.getElementById('empty');

    function showView(viewId) {
        [loadingView, resultsView, emptyView].forEach(view => {
            view.classList.toggle('hidden', view.id !== viewId);
        });
    }

    function renderResults(technologies) {
        if (!technologies || technologies.length === 0) {
            showView('empty');
            return;
        }

        resultsView.innerHTML = '';

        // Group by category
        const groups = {};
        technologies.forEach(tech => {
            const cat = (tech.categories && tech.categories[0]) || 'Other';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(tech);
        });

        Object.keys(groups).sort().forEach(category => {
            const groupEl = document.createElement('div');
            groupEl.className = 'category-group';

            const titleEl = document.createElement('div');
            titleEl.className = 'category-title';
            titleEl.textContent = category;
            groupEl.appendChild(titleEl);

            groups[category].forEach(tech => {
                const card = document.createElement('div');
                card.className = 'tech-card';

                const letter = tech.name.charAt(0).toUpperCase();
                card.innerHTML = `
                    <div class="tech-icon">${letter}</div>
                    <div class="tech-info">
                        <div class="tech-name">${tech.name}</div>
                    </div>
                `;
                groupEl.appendChild(card);
            });

            resultsView.appendChild(groupEl);
        });

        showView('results');
    }

    async function getActiveTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    const tab = await getActiveTab();
    if (!tab) {
        showView('empty');
        return;
    }

    const storageKey = `tab_${tab.id}`;

    // Listen for storage updates
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes[storageKey]) {
            renderResults(changes[storageKey].newValue);
        }
    });

    // Check for existing results first
    const result = await chrome.storage.local.get([storageKey]);
    if (result[storageKey]) {
        renderResults(result[storageKey]);
        return;
    }

    // No stored results - check if content script is ready
    try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'ping' });

        if (response && response.analysisComplete) {
            // Analysis done, get results directly
            const resultsResponse = await chrome.tabs.sendMessage(tab.id, { type: 'getResults' });
            if (resultsResponse && resultsResponse.data) {
                renderResults(resultsResponse.data);
                return;
            }
        }

        // Content script exists but analysis not complete - request it
        await chrome.tabs.sendMessage(tab.id, { type: 'analyze' });
        // Wait for storage update via listener

    } catch (e) {
        // Content script not available - try to inject it
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['scripts/content.js']
            });
            // Script will run analysis automatically
        } catch (err) {
            // Injection failed (probably a restricted page)
            const loadingText = loadingView.querySelector('p');
            if (loadingText) {
                loadingText.textContent = 'Cannot analyze this page';
            }
        }
    }

    // Timeout fallback - show empty if no results after 5 seconds
    setTimeout(() => {
        if (!loadingView.classList.contains('hidden')) {
            showView('empty');
        }
    }, 5000);
});
