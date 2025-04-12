class FakeZeroPostAnalysis {
    constructor() {
        console.debug('[FakeZero] Initializing post analysis listener');
        this.initializeElements();
        this.setupMessageListener();
        this.setupCloseButton();
    }

    initializeElements() {
        console.debug('[FakeZero] Initializing UI elements');
        this.elements = {
            postContent: document.getElementById('post-content'),
            platform: document.getElementById('platform'),
            sentimentScore: document.getElementById('sentiment-score'),
            sourcesCheck: document.getElementById('sources-check'),
            closeBtn: document.querySelector('.close-btn')
        };
    }

    setupMessageListener() {
        console.debug('[FakeZero] Setting up message listener');
    
        window.addEventListener('message', (event) => {
            if (!event.data || event.data.type !== 'POST_DATA') {
                return;
            }
    
            console.debug('[FakeZero] Received post data:', event.data);
    
            // Remove loading state from elements
            this.elements.postContent.textContent = event.data.content || 'No content available';
            this.elements.postContent.classList.remove('loading');
    
            this.elements.sentimentScore.textContent = 'Analysis pending...';
            this.elements.sentimentScore.classList.remove('loading');
    
            this.elements.sourcesCheck.innerHTML = '<li>Source verification in progress</li>';
            this.elements.sourcesCheck.classList.remove('loading');
        });
    }
    

    setupCloseButton() {
        console.debug('[FakeZero] Setting up close button');

        this.elements.closeBtn.addEventListener('click', () => {
            console.debug('[FakeZero] Closing post analysis popup');
            window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*');
        });
    }
}

console.log('[FakeZero] Initializing post-analysis script');
document.addEventListener('DOMContentLoaded', () => {
    new FakeZeroPostAnalysis();
});

updateCredibility(status) {
    this.elements.credibilityStatus.textContent = status;
    this.elements.credibilityStatus.classList.remove('checking-animation'); // Stop animation when done
}
