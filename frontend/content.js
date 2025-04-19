class FakeNewsDetector {

    isValidNewsContent(text) {
        if (!text) return false;
    
        const wordCount = text.trim().split(/\s+/).length;
    
        // Skip very short or one-liner posts
        if (text.length < 50 || wordCount < 10) return false;
    
        // Mostly non-text (emojis, hashtags, links)
        const plainTextRatio = text.replace(/[^\w\sÀ-ÿ]/gi, '').length / text.length;
        if (plainTextRatio < 0.5) return false;
    
        // Optional: skip obvious promos
        const lower = text.toLowerCase();
        const skipWords = ["apply now", "sign up", "promo", "click here", "limited offer"];
        if (skipWords.some(w => lower.includes(w))) return false;
    
        return true;
    }
    
    
    constructor() {
        this.observer = null;
        this.extensionEnabled = true;
        this.processedPosts = new WeakSet();
        this.fakeNewsCount = 0; // 🔥 Counter for detected fake news
        this.platformConfig = this.detectPlatform();
        this.initialize();
    }


    async initialize() {
        console.log('Initializing detector...');
        await this.loadExtensionState();
        this.setupObservers();
        this.setupMessageListener();
        if (this.extensionEnabled) {
            this.scanInitialPosts(); // 🔥 Ensures warnings appear when activated
        }
    }

    detectPlatform() {
        const hostname = window.location.hostname;
        const config = {
            selectors: {
                post: '',
                adMarker: '',
                content: ''
            },
            isFacebook: false,
            isInstagram: false,
            isTwitter: false
        };

        if (hostname.includes('facebook.com')) {
            config.selectors = {
                post: 'div[data-ad-comet-preview="message"]',
                adMarker: '[aria-label="Sponsored"]',
                content: 'div.xdj266r'
            };
            config.isFacebook = true;
        } else if (hostname.includes('instagram.com')) {
            config.selectors = {
                post: 'article._aatb',
                adMarker: 'div._aaaw',
                content: 'div._a9zs'
            };
            config.isInstagram = true;
        } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            config.selectors = {
                post: 'article[data-testid="tweet"]',
                adMarker: 'div[data-testid="badge"]',
                content: 'div[data-testid="tweetText"]'
            };
            config.isTwitter = true;
        }

        console.log(`Detected platform: ${config.isFacebook ? 'Facebook' : config.isInstagram ? 'Instagram' : config.isTwitter ? 'Twitter' : 'Unknown'}`);
        return config;
    }

    async loadExtensionState() {
        const { isActive } = await chrome.storage.local.get('isActive');
        this.extensionEnabled = isActive !== false;
        console.log('Extension state loaded:', this.extensionEnabled);
    }

    teardownObservers() {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        this.processedPosts = new WeakSet();
        console.log('Observers torn down');
    }

    setupObservers() {
        console.log('Setting up observers...');
    
        // Intersection Observer for detecting posts in view
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.extensionEnabled) {
                    console.log('Processing post:', entry.target);
                    this.processPost(entry.target);
                }
            });
        }, { rootMargin: '0px 0px 200px 0px' });
    
        // Mutation Observer for dynamically loaded posts and images
        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        let newImages = this.extractFacebookImages(node); // ✅ Fix: Use 'this.'
                        if (newImages.length > 0) {
                            console.log('[Observer] New images detected:', newImages);
                        }
                        // Observe newly added posts for processing
                        if (
                            node.matches(this.platformConfig.selectors.post) ||
                            node.querySelector(this.platformConfig.selectors.post)
                        ) {
                            const post = node.matches(this.platformConfig.selectors.post)
                                ? node
                                : node.querySelector(this.platformConfig.selectors.post);
                        
                            if (!this.processedPosts.has(post)) {
                                this.intersectionObserver.observe(post);
                            }
                        }
                        
                    }
                });
            });
        });
    
        // Start observing changes in the entire document
        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    
        console.log('MutationObserver is now active.');
    }

    handleMutation(mutation) {
        if (!this.extensionEnabled) {
            return;
        }

        const posts = this.getPostsFromMutation(mutation);
        if (!posts) {
            console.error('[FakeZero] getPostsFromMutation returned undefined or null');
            return;
        }

        posts.forEach(post => {
            if (!this.processedPosts.has(post)) {
                this.intersectionObserver.observe(post);
            }
        });
    }

    getPostsFromMutation(mutation) {
        const posts = [];
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                
                if (this.platformConfig.isFacebook) {
                    const fbPost = node.matches(this.platformConfig.selectors.post)
                        ? node
                        : node.querySelector(this.platformConfig.selectors.post);
                    if (fbPost) posts.push(fbPost);
                } else if (this.platformConfig.isInstagram) {
                    const igPost = node.closest(this.platformConfig.selectors.post);
                    if (igPost) posts.push(igPost);
                } else if (this.platformConfig.isTwitter) {
                    const twitterPost = node.closest(this.platformConfig.selectors.post);
                    if (twitterPost) posts.push(twitterPost);
                }
            }
        });
        return posts;
    }

    scanInitialPosts() {
        console.log('Scanning initial posts for warnings...');
        const posts = document.querySelectorAll(this.platformConfig.selectors.post);
        posts.forEach(post => {
            this.processPost(post, true); // 🔥 Force reprocessing and restore warnings
        });
    }


    setupMessageListener() {
        console.log('Setting up message listener...');
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'EXTENSION_STATE_UPDATE') {
                this.handleExtensionStateUpdate(request);
            }
        });
    }



    async extractFullTextFromPost(postElement) {
        // 🔁 Rechercher tous les éléments cliquables potentiels
        const seeMoreBtn = Array.from(postElement.querySelectorAll('div[role="button"], span[role="button"]'))
            .find(el => /(voir plus|see more)/i.test(el.textContent.trim()));
    
        if (seeMoreBtn) {
            console.log("🟢 Click sur : ", seeMoreBtn.textContent);
            seeMoreBtn.click();
            await new Promise(resolve => setTimeout(resolve, 300)); // ⏳ attendre que le texte se charge
        }
    
        // 🔍 Extraire tout le texte visible
        const extractedText = new Set();
        const textElements = postElement.querySelectorAll('*');
    
        textElements.forEach(element => {
            if (
                element.tagName.toLowerCase() !== 'img' &&
                element.getAttribute('role') !== 'button'
            ) {
                const content = element.textContent?.trim();
                if (content) extractedText.add(content);
            }
        });
    
        const result = Array.from(extractedText).join('\n');
        console.log("[📝 Texte extrait complet]", result);
        return result;
    }
    
    
    
    
    async extractPostDetails(postElement) {
        const text = await this.extractFullTextFromPost(postElement);
        const links = this.extractLinksFromPost(postElement);
        const images = this.extractFacebookImages(postElement);
    
        return { text, links, images };
    }
    
    extractLinksFromPost(postElement) {
        let links = [];
        const linkElements = postElement.querySelectorAll('a[href]');
    
        linkElements.forEach(link => {
            let url = link.href;
            if (url && !links.includes(url)) {
                links.push(url);
            }
        });
    
        return links;
    }

    
    extractFacebookImages(postElement) {
        let images = new Set(); // Using Set to avoid duplicates
    
        // 1️⃣ Extract direct <img> elements
        const imgElements = postElement.querySelectorAll('img');
        imgElements.forEach(img => {
            let src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('srcset');
            if (src) {
                let decodedSrc = new DOMParser().parseFromString(src, "text/html").body.textContent;
                images.add(decodedSrc);
            }
        });
    
        // 2️⃣ Extract background images from divs
        const divElements = postElement.querySelectorAll('div');
        divElements.forEach(div => {
            let backgroundImage = window.getComputedStyle(div).getPropertyValue('background-image');
            if (backgroundImage && backgroundImage.startsWith('url(')) {
                let url = backgroundImage.replace(/url\(['"]?(.*?)['"]?\)/, '$1'); // Extract URL
                if (url) images.add(url);
            }
        });
    
        console.log('[Facebook Image Extractor] Found Images:', Array.from(images));
        return Array.from(images); // Convert Set to Array for easy use
    }

    async processPost(post, force = false) {
        if (!this.extensionEnabled) return;
        if (this.processedPosts.has(post)) return;
    
        const analyzing = document.createElement("div");
        analyzing.innerText = "⏳ Analyzing post...";
        post.appendChild(analyzing);
    
        const { text, links, images } = await this.extractPostDetails(post);
    
        // Optional: log for debugging
        console.log('[FakeZero] Text:', text);
        console.log('[FakeZero] Links:', links);
        console.log('[FakeZero] Images:', images);
    
        if (!this.isValidNewsContent(text)) {
            analyzing.remove();
            this.showNonNewsNotice(post);
            this.processedPosts.add(post);
            return;
        }
    
        this.processedPosts.add(post);
    
        try {
            const response = await fetch("http://localhost:5000/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: text.slice(0, 100),
                    text: text,
                    links: links,
                    images: images
                })
            });
    
            const result = await response.json();
            analyzing.remove();
    
            const label = result.prediction;
            if (label.includes("FAKE")) {
                this.addWarningIcon(post, label);
                chrome.storage.local.get(['fakeNewsCount'], (result) => {
                    const currentCount = result.fakeNewsCount || 0;
                    chrome.storage.local.set({ fakeNewsCount: currentCount + 1 });
                });
            } else {
                this.addSafeIcon(post, label);
            }
    
        } catch (err) {
            analyzing.remove();
            console.error("🔥 Prediction failed:", err);
        }
    }
    
    
    
    
    showNonNewsNotice(post) {
        const notice = document.createElement("div");
        notice.innerText = "🛑 This doesn't appear to be a news post.";
        Object.assign(notice.style, {
            color: "gray",
            fontStyle: "italic",
            backgroundColor: "#f0f0f0",
            padding: "5px 10px",
            borderLeft: "4px solid #999",
            borderRadius: "4px",
            marginTop: "8px",
            fontSize: "13px"
        });
        post.appendChild(notice);
    }
    

    // async processPost(post, force = false) {
    //     if (!this.extensionEnabled) return;
    //     if (this.processedPosts.has(post) && !force) return;

    //     let content = this.extractFullTextFromPost(post);
    //     if (content) {
    //         console.log('[FakeZero] Extracted post content:\n', content);
    //     }

    //     this.addWarningIcon(post);
    //     this.processedPosts.add(post);
    // }
    

    addWarningIcon(post, label = "⚠️ Fake News") {
        // ❌ Remove previous verdicts if they exist
        const oldVerdict = post.querySelector('.fakezero-warning-container') || post.querySelector('.fakezero-safe');
        if (oldVerdict) oldVerdict.remove();
    
        // ✅ Create new verdict container
        const container = document.createElement("div");
        container.className = "fakezero-warning-container";
    
        Object.assign(container.style, {
            color: "red",
            fontWeight: "bold",
            backgroundColor: "#ffe6e6",
            padding: "6px 10px",
            borderLeft: "4px solid #cc0000",
            borderRadius: "5px",
            marginTop: "8px"
        });
    
        container.innerText = label;
        post.appendChild(container);
    }
    
    
    
    addSafeIcon(post, label = "✅ Real News") {
        // ❌ Remove previous verdicts if they exist
        const oldVerdict = post.querySelector('.fakezero-warning-container') || post.querySelector('.fakezero-safe');
        if (oldVerdict) oldVerdict.remove();
    
        // ✅ Create new verdict container
        const container = document.createElement("div");
        container.className = "fakezero-safe";
    
        Object.assign(container.style, {
            color: "green",
            fontWeight: "bold",
            backgroundColor: "#e6f5e6",
            padding: "6px 10px",
            borderLeft: "4px solid #009900",
            borderRadius: "5px",
            marginTop: "8px"
        });
    
        container.innerText = label;
        post.appendChild(container);
    }
    
    
    


    handleExtensionStateUpdate(request) {
        console.log('Handling extension state update:', request.isActive);
        this.extensionEnabled = request.isActive;
        if (this.extensionEnabled) {
            console.log('Extension activated, resetting state and re-scanning posts...');
            // this.processedPosts = new WeakSet();  // 🔥 Reset processed posts
            this.scanInitialPosts();   // 🔥 Reprocess all posts and restore warnings
        } else {
            console.log('Extension deactivated, removing warnings...');
            this.removeAllWarnings();
        }
    }


    removeAllWarnings() {
        document.querySelectorAll('.fakezero-warning-icon').forEach(icon => icon.remove());
        document.querySelectorAll('.fakezero-warning-container').forEach(container => container.remove());
        console.log('All warning icons removed, text remains.');
    }
    

    async checkFakeNews(content) {
       
    }
}

// 🔥 Listen for storage changes to reactivate automatically
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.isActive) {
        console.log(`Extension state changed: ${changes.isActive.newValue}`);
        this.handleExtensionStateUpdate({ isActive: changes.isActive.newValue });
    }
});



// Add animation for a glowing effect
const styleSheet = document.createElement("style");
styleSheet.innerHTML = `
    @keyframes pulse-glow {
        0% {
            box-shadow: 0 2px 6px rgba(255, 59, 48, 0.4);
        }
        100% {
            box-shadow: 0 4px 12px rgba(255, 59, 48, 0.7);
        }
    }
`;
document.head.appendChild(styleSheet);

new FakeNewsDetector();
