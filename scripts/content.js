// Content script - runs in Isolated World
(function () {
    // Guard against duplicate execution
    if (window.__webAnalystInitialized) {
        return;
    }
    window.__webAnalystInitialized = true;

    console.log('[WebDepth] Content script running');

    let techData = null;
    let analysisComplete = false;
    let detectedTechnologies = [];

    // Handle messages from popup/background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'ping') {
            sendResponse({ status: 'ready', analysisComplete });
            return true;
        }
        if (message.type === 'getResults') {
            sendResponse({ data: detectedTechnologies });
            return true;
        }
        if (message.type === 'analyze') {
            runAnalysis();
            sendResponse({ status: 'started' });
            return true;
        }
    });

    async function loadTechData() {
        try {
            const url = chrome.runtime.getURL('data/technologies.json');
            const response = await fetch(url);
            techData = await response.json();
            console.log('[WebDepth] Technology data loaded:', Object.keys(techData).length, 'items');
        } catch (e) {
            console.error('[WebDepth] Failed to load technology data:', e);
        }
    }

    function injectDetector() {
        return new Promise((resolve) => {
            // Check if already injected
            if (document.querySelector('script[data-webanalyst-detector]')) {
                resolve(true);
                return;
            }

            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('scripts/detector.js');
            script.setAttribute('data-webanalyst-detector', 'true');

            script.onload = function () {
                this.remove();
                resolve(true);
            };

            script.onerror = function () {
                console.warn('[WebDepth] Detector blocked by CSP, continuing with DOM checks only');
                this.remove();
                resolve(false);
            };

            (document.head || document.documentElement).appendChild(script);
        });
    }

    function runDOMChecks() {
        const results = [];
        if (!techData) return results;

        for (const [name, rules] of Object.entries(techData)) {
            let match = false;

            // Check CSS selectors
            if (rules.selector) {
                for (const selector of rules.selector) {
                    try {
                        if (document.querySelector(selector)) {
                            match = true;
                            break;
                        }
                    } catch (e) {
                        // Invalid selector
                    }
                }
            }

            // Check meta tags
            if (!match && rules.meta) {
                for (const [metaName, metaContent] of Object.entries(rules.meta)) {
                    const metaTag = document.querySelector(`meta[name="${metaName}"]`);
                    if (metaTag && metaTag.content && metaTag.content.includes(metaContent)) {
                        match = true;
                        break;
                    }
                }
            }

            // Check script sources
            if (!match && rules.scriptSrc) {
                const scripts = Array.from(document.scripts);
                for (const srcFragment of rules.scriptSrc) {
                    if (scripts.some(s => s.src && s.src.includes(srcFragment))) {
                        match = true;
                        break;
                    }
                }
            }

            if (match) {
                results.push({ name, categories: rules.categories });
            }
        }

        return results;
    }

    function checkWindowVariables() {
        return new Promise((resolve) => {
            const windowKeysToCheck = [];
            const keyToTechMap = {};

            for (const [name, rules] of Object.entries(techData)) {
                if (rules.window) {
                    rules.window.forEach(key => {
                        windowKeysToCheck.push(key);
                        if (!keyToTechMap[key]) keyToTechMap[key] = [];
                        keyToTechMap[key].push(name);
                    });
                }
            }

            if (windowKeysToCheck.length === 0) {
                resolve([]);
                return;
            }

            let responded = false;

            const messageHandler = (event) => {
                if (event.source !== window) return;
                if (!event.data) return;

                if (event.data.type === 'WebAnalyst_Result') {
                    responded = true;
                    window.removeEventListener('message', messageHandler);

                    const results = [];
                    const detectedKeys = event.data.detected || [];

                    detectedKeys.forEach(key => {
                        const techNames = keyToTechMap[key];
                        if (techNames) {
                            techNames.forEach(techName => {
                                if (!results.find(t => t.name === techName)) {
                                    results.push({
                                        name: techName,
                                        categories: techData[techName].categories
                                    });
                                }
                            });
                        }
                    });

                    resolve(results);
                }
            };

            window.addEventListener('message', messageHandler);

            // Use postMessage for cross-world communication
            window.postMessage({ type: 'WebAnalyst_Check', keys: windowKeysToCheck }, '*');

            // Timeout fallback
            setTimeout(() => {
                if (!responded) {
                    window.removeEventListener('message', messageHandler);
                    console.warn('[WebDepth] Window check timed out');
                    resolve([]);
                }
            }, 1500);
        });
    }

    async function runAnalysis() {
        if (!techData) {
            await loadTechData();
        }

        if (!techData) {
            sendResults([]);
            return;
        }

        // Run DOM checks first
        const domResults = runDOMChecks();
        console.log('[WebDepth] DOM check results:', domResults.length);

        // Inject detector and check window variables
        await injectDetector();

        // Small delay to ensure detector is ready
        await new Promise(r => setTimeout(r, 50));

        const windowResults = await checkWindowVariables();
        console.log('[WebDepth] Window check results:', windowResults.length);

        // Combine results, avoiding duplicates
        const allResults = [...domResults];
        windowResults.forEach(wr => {
            if (!allResults.find(r => r.name === wr.name)) {
                allResults.push(wr);
            }
        });

        sendResults(allResults);
    }

    function sendResults(results) {
        detectedTechnologies = results;
        analysisComplete = true;
        console.log('[WebDepth] Analysis complete:', results.length, 'technologies detected');
        chrome.runtime.sendMessage({ type: 'analysis_complete', data: results });
    }

    // Initialize
    async function init() {
        await loadTechData();

        if (document.readyState === 'complete') {
            runAnalysis();
        } else if (document.readyState === 'interactive') {
            // DOM ready but resources still loading - good enough
            runAnalysis();
        } else {
            window.addEventListener('DOMContentLoaded', () => runAnalysis());
        }
    }

    init();
})();
