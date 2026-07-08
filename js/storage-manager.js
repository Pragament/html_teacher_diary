// ================================================================
//  LOCALSTORAGE STORAGE MANAGER
//  Manages API caching with TTL, versioning, and validation.
// ================================================================

(function () {
    const STORAGE_PREFIX = 'api_cache_';
    const MODULE_VERSION = '1.0';

    /**
     * Helper to get full namespace key
     */
    function getFullKey(key) {
        return key.startsWith(STORAGE_PREFIX) ? key : STORAGE_PREFIX + key;
    }

    /**
     * Store API response with timestamp and optional TTL
     * @param {string} key 
     * @param {any} data 
     * @param {number} [ttl] - Time-to-live in milliseconds
     * @returns {boolean} - Success status
     */
    function saveApiData(key, data, ttl) {
        if (!key) return false;
        
        const fullKey = getFullKey(key);
        const timestamp = Date.now();
        const expiry = (typeof ttl === 'number' && ttl > 0) ? (timestamp + ttl) : null;

        const payload = {
            data: data,
            timestamp: timestamp,
            expiry: expiry,
            version: MODULE_VERSION
        };

        try {
            localStorage.setItem(fullKey, JSON.stringify(payload));
            return true;
        } catch (error) {
            console.error(`StorageManager: Failed to write to localStorage for key "${key}":`, error);
            
            // Handle QuotaExceededError (clean up expired keys to free space)
            if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                console.warn('StorageManager: Quota exceeded. Evicting expired cache keys...');
                evictExpiredKeys();
                
                // Retry saving once
                try {
                    localStorage.setItem(fullKey, JSON.stringify(payload));
                    return true;
                } catch (retryError) {
                    console.error('StorageManager: Retry failed after eviction.', retryError);
                }
            }
            return false;
        }
    }

    /**
     * Retrieve data with automatic expiration check
     * @param {string} key 
     * @returns {any|null} - Parsed data or null if not found/expired/invalid
     */
    function getApiData(key) {
        if (!key) return null;
        
        const fullKey = getFullKey(key);
        try {
            const raw = localStorage.getItem(fullKey);
            if (!raw) return null;

            const payload = JSON.parse(raw);
            
            // Validate payload structure
            if (!payload || typeof payload !== 'object' || !('data' in payload) || !payload.version) {
                console.warn(`StorageManager: Corrupted cache structure for key "${key}". Cleaning up...`);
                removeApiData(key);
                return null;
            }

            // Version check
            if (payload.version !== MODULE_VERSION) {
                console.info(`StorageManager: Version mismatch for key "${key}". Evicting...`);
                removeApiData(key);
                return null;
            }

            // Expiry check
            if (payload.expiry !== null && Date.now() > payload.expiry) {
                console.info(`StorageManager: Cache expired for key "${key}". Evicting...`);
                removeApiData(key);
                return null;
            }

            return payload.data;
        } catch (error) {
            console.error(`StorageManager: Error reading key "${key}":`, error);
            removeApiData(key); // Cleanup potential corrupted JSON string
            return null;
        }
    }

    /**
     * Delete specific item
     * @param {string} key 
     */
    function removeApiData(key) {
        if (!key) return;
        localStorage.removeItem(getFullKey(key));
    }

    /**
     * Clear all stored API data starting with prefix
     */
    function clearAllApiData() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(STORAGE_PREFIX)) {
                keysToRemove.push(k);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
    }

    /**
     * Evict all expired keys in localStorage namespace
     */
    function evictExpiredKeys() {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(STORAGE_PREFIX)) {
                try {
                    const raw = localStorage.getItem(k);
                    if (raw) {
                        const payload = JSON.parse(raw);
                        if (payload && payload.expiry !== null && Date.now() > payload.expiry) {
                            localStorage.removeItem(k);
                        }
                    }
                } catch {
                    localStorage.removeItem(k); // remove corrupted keys
                }
            }
        }
    }

    /**
     * Calculate current storage usage of cached API keys in bytes
     * @returns {number}
     */
    function getStorageSize() {
        let totalBytes = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(STORAGE_PREFIX)) {
                const val = localStorage.getItem(k);
                if (val) {
                    // String length * 2 represents approximate UTF-16 bytes in browser memory
                    totalBytes += (k.length + val.length) * 2;
                }
            }
        }
        return totalBytes;
    }

    // Expose utility globally under window.StorageManager
    window.StorageManager = {
        saveApiData,
        getApiData,
        removeApiData,
        clearAllApiData,
        getStorageSize
    };
})();
