// Detector script - runs in Main World to access window globals
(function () {
    // Listen for check requests via postMessage (works across worlds)
    window.addEventListener('message', function (event) {
        if (event.source !== window) return;
        if (!event.data || event.data.type !== 'WebAnalyst_Check') return;

        const keysToCheck = event.data.keys || [];
        const detected = [];

        keysToCheck.forEach(key => {
            try {
                if (window[key] !== undefined) {
                    detected.push(key);
                }
            } catch (e) {
                // Some properties may throw on access
            }
        });

        // Send results back via postMessage
        window.postMessage({ type: 'WebAnalyst_Result', detected: detected }, '*');
    });

    // Signal that detector is ready
    window.postMessage({ type: 'WebAnalyst_DetectorReady' }, '*');
})();
