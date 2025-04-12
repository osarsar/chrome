class FakeZeroPopup {
    constructor() {
        console.debug('[FakeZero] Initializing popup');
        this.initializeElements();
        this.initializeState();
        this.setupEventListeners();
        this.setupStorageListener();
    }

    initializeElements() {
        this.elements = {
            toggleSwitch: document.getElementById('toggleSwitch'),
            statusIndicator: document.getElementById('statusIndicator'),
            fakeNewsCounter: document.getElementById('fakeNewsCounter') // 🔥 Added for displaying count
        };
    }

    setupStorageListener() {
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.fakeNewsCount) {
                this.state.fakeNewsCount = changes.fakeNewsCount.newValue;
                this.updateUI();
                console.log('[FakeZero] Counter updated from storage');
            }
        });
    }

    async initializeState() {
        console.debug('[FakeZero] Loading initial state');
        const { isActive = true, fakeNewsCount = 0 } = await chrome.storage.local.get([
            'isActive',
            'fakeNewsCount'
        ]);

        this.state = {
            isActive,
            fakeNewsCount
        };
        console.log(`[FakeZero] Loaded state - Active: ${isActive}, Count: ${fakeNewsCount}`);
        this.updateUI();
    }

    setupEventListeners() {
        this.elements.toggleSwitch.addEventListener('change', () => this.toggleExtension());
        
        // Add event listener for reset button
        document.getElementById('resetCounterBtn').addEventListener('click', () => this.resetCounter());
    }
    
    async resetCounter() {
        console.log('[FakeZero] Resetting fake news counter...');
        
        // Add animation effect on click
        const button = document.getElementById('resetCounterBtn');
        button.style.transform = 'scale(0.9)';
        setTimeout(() => button.style.transform = 'scale(1)', 150);
        
        // Reset the counter
        await chrome.storage.local.set({ fakeNewsCount: 0 });
        
        // Update the UI immediately
        this.state.fakeNewsCount = 0;
        this.updateUI();
    }
    
    
    
    
    async ensureContentScriptInjected(tabId) {
        try {
            console.debug(`[FakeZero] Injecting content script into tab ${tabId}`);
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js']
            });
        } catch (error) {
            console.log('[FakeZero] Content script already injected');
        }
    }


    handleScanResponse(response) {
        if (response?.success) {
            const newCount = this.state.fakeNewsCount + response.newDetections;
            console.log(`[FakeZero] Scan successful, new detections: ${response.newDetections}`);
            this.updateFakeNewsCount(newCount);
            this.updateStatus(`Found ${response.newDetections} new items`, 'success');
        } else {
            console.log('[FakeZero] Scan completed with no new findings');
            this.updateStatus('Scan completed - no new findings', 'info');
        }
    }

    handleScanError(error) {
        console.error('[FakeZero] Scan error:', error);
        if (error.message.includes('Receiving end does not exist')) {
            console.warn('[FakeZero] Content script not ready - needs page reload');
            this.updateStatus('Reload page to scan', 'error');
        } else {
            this.updateStatus('Scan failed - try reloading', 'error');
        }
    }

    async toggleExtension() {
        const newState = !this.state.isActive;
        this.state.isActive = newState;
        await chrome.storage.local.set({ isActive: this.state.isActive });
        this.updateUI();
        this.sendStateToContentScripts();

        // Force content script re-injection when activating
        if (newState) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) await this.ensureContentScriptInjected(tab.id);
        }
    }

    updateUI() {
        this.elements.toggleSwitch.checked = this.state.isActive;
        this.elements.statusIndicator.style.backgroundColor = this.state.isActive ? '#FF5722' : '#a8a8a8';
        this.elements.fakeNewsCounter.textContent = `${this.state.fakeNewsCount}`; // 🔥 Updates count display
    }
    

    updateStatus(message, statusType = 'info') {
        console.log(`[FakeZero] Status update: ${message} (${statusType})`);
        const statusColors = {
            info: '#2196F3',
            processing: '#FFC107',
            success: '#4CAF50',
            error: '#F44336'
        };

        this.elements.statusIndicator.style.backgroundColor = statusColors[statusType];
    }

    async sendStateToContentScripts() {
        console.debug('[FakeZero] Sending state to content scripts');
        const tabs = await chrome.tabs.query({});
        console.log(`[FakeZero] Sending to ${tabs.length} tabs`);
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'EXTENSION_STATE_UPDATE',
                isActive: this.state.isActive
            });
        });
    }
}

async function loadExtractedData() {
    const { extractedData } = await chrome.storage.local.get('extractedData');

    if (extractedData) {
        document.getElementById('postText').innerText = extractedData.content || 'No text';
        document.getElementById('postLinks').innerText = extractedData.links.join('\n') || 'No links';

        let imageContainer = document.getElementById('postImages');
        imageContainer.innerHTML = ''; // Clear previous images

        extractedData.images.forEach(src => {
            let imgElement = document.createElement('img');
            imgElement.src = src;
            imgElement.style.width = '100px';
            imgElement.style.height = 'auto';
            imgElement.style.margin = '5px';
            imgElement.style.borderRadius = '5px';
            imgElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

            // Append to container
            imageContainer.appendChild(imgElement);
        });
    }
}

document.addEventListener('DOMContentLoaded', loadExtractedData);



console.log('[FakeZero] Initializing popup script');
document.addEventListener('DOMContentLoaded', () => {
    new FakeZeroPopup();
});

