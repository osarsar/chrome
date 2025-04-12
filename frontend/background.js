
chrome.runtime.onInstalled.addListener(() => {
    console.log("Fake News Detector Installed and Running");
});





console.log('Background script initialized');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openPopup') {
        chrome.action.openPopup();
    }
});




chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openAnalysisPopup') {
        // 1) Switch the extension popup to "post-analysis.html"
        chrome.action.setPopup({ popup: 'post-analysis/post-analysis.html' }, () => {
            // 2) Open the extension popup
            chrome.action.openPopup(() => {
                // 3) Once opened, revert back to the default "popup.html"
                chrome.action.setPopup({ popup: 'popup/popup.html' });
            });
        });
    }
});

