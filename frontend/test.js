class FakeNewsDetector {
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
                        if (node.matches(this.platformConfig.selectors.post) || node.querySelector(this.platformConfig.selectors.post)) {
                            this.intersectionObserver.observe(node);
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



    extractFullTextFromPost(postElement) {
        let extractedText = new Set(); 
        let textElements;
        if (this.platformConfig.isTwitter) {

            textElements = postElement.querySelectorAll(this.platformConfig.selectors.content);
        } else {
            
            textElements = postElement.querySelectorAll('*');
        }

        textElements.forEach(element => {
        
            if (element.tagName.toLowerCase() !== 'img' && element.getAttribute('role') !== 'button') {
                const textContent = element.textContent.trim();
                if (textContent && !extractedText.has(textContent)) {
                    extractedText.add(textContent); 
                }
            }
        });

        return Array.from(extractedText).join("\n");
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
        if (this.processedPosts.has(post) && !force) return;
    
        console.log('[FakeZero] Processing post:', post);
    
        // ✅ Correct function calls
        let content = this.extractFullTextFromPost(post);
        let links = this.extractLinksFromPost(post); // ✅ Fix: Use this.
        
        // Delay image extraction for lazy loading
        setTimeout(() => {
            let images = this.extractFacebookImages(post);
            console.log('[FakeZero] Extracted images:', images);
    
            // Store extracted data in Chrome storage
            chrome.storage.local.set({ extractedData: { content, links, images } });
    
            // ✅ Delay warning addition to ensure the post is fully loaded
            setTimeout(() => {
                this.addWarningIcon(post);
                this.processedPosts.add(post);
            }, 1000);
    
        }, 3000); // Adjust if necessary
    
        console.log('[FakeZero] Extracted text and links:', { content, links });
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
    

    addWarningIcon(post) {
        try {
            const icon = document.createElement('div');
            icon.id = 'debug-warning-icon';
            icon.style.width = '30px';
            icon.style.height = '30px';
            icon.style.backgroundColor = 'red';
            icon.style.position = 'absolute';
            icon.style.zIndex = '9999';

            icon.style.top = '0px';
            icon.style.right = '10px';

            icon.style.cursor = 'pointer';
            icon.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';

            icon.innerText = '!';
            icon.style.color = 'white';
            icon.style.display = 'flex';
            icon.style.alignItems = 'center';
            icon.style.justifyContent = 'center';
            icon.style.fontWeight = 'bold';
            icon.addEventListener('click', (event) => {
                event.stopPropagation();
                try {
                    chrome.runtime.sendMessage({ action: 'openAnalysisPopup' });

                    icon.style.transform = 'scale(1.1)';
                    setTimeout(() => {
                        icon.style.transform = 'scale(1)';
                    }, 200);
                } catch (error) {
                    console.error('Error opening extension:', error);
                }
            });


          
            post.style.position = 'relative';

        
            post.appendChild(icon);
            console.log('Clickable warning icon added successfully');
        } catch (error) {
            console.error('Error adding warning icon:', error);
        }
    }


    handleExtensionStateUpdate(request) {
        console.log('Handling extension state update:', request.isActive);
        this.extensionEnabled = request.isActive;
        if (this.extensionEnabled) {
            console.log('Extension activated, resetting state and re-scanning posts...');
            this.processedPosts = new WeakSet();  // 🔥 Reset processed posts
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
