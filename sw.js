const CACHE_NAME = 'teacher-diary-v15';
const ASSETS = [
    './',
    './index.html',
    './dashboard.html',
    './css/styles.css',
    './js/app.js',
    './js/ui.js',
    './js/data.js',
    './js/auth.js',
    './js/supabase.js',
    './js/file-upload.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS).catch(err => {
                console.warn('Service worker install error (some assets might fail):', err);
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // We only want to cache GET requests for our own origin
    if (event.request.method !== 'GET') return;
    
    // Ignore supabase API requests or external CDNs in standard cache (cache only local static assets)
    const url = new URL(event.request.url);
    if (!url.origin.includes(location.origin)) return;
    
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                // Return cached version but fetch from network in background to update cache
                event.waitUntil(
                    fetch(event.request).then(response => {
                        return caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, response.clone());
                        });
                    }).catch(() => { /* Ignore network errors in background update */ })
                );
                return cachedResponse;
            }
            return fetch(event.request).catch(() => {
                // Fallback for failed network requests when offline
                console.warn('Network request failed and not in cache:', event.request.url);
            });
        })
    );
});
