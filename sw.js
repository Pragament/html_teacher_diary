const CACHE_NAME = 'teacher-diary-v35';
const ASSETS = [
    './',
    './index.html',
    './dashboard.html',
    './slow_learner.html',
    './css/styles.css',
    './css/slow_learner.css',
    './js/app.js',
    './js/ui.js',
    './js/data.js',
    './js/auth.js',
    './js/supabase.js',
    './js/file-upload.js',
    './js/slow_learner.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.all(
                ASSETS.map(url => {
                    return fetch(new Request(url, { cache: 'no-cache' }))
                        .then(response => {
                            if (!response.ok) throw new Error('Network response was not ok');
                            return cache.put(url, response);
                        });
                })
            ).catch(err => {
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
    // Network first for HTML and dynamic scripts to ensure immediate updates
    if (event.request.method !== 'GET') return;
    
    const url = new URL(event.request.url);
    if (!url.origin.includes(location.origin)) return;
    
    // For HTML, JS, CSS, always try network first
    event.respondWith(
        fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
        }).catch(() => {
            return caches.match(event.request);
        })
    );
});
