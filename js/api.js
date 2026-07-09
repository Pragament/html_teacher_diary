// ================================================================
//  API CLIENT — All content fetched via Supabase REST URLs
//  The frontend NEVER contains educational content.
//  This module is the ONLY place that calls content endpoints.
// ================================================================

const API_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ================================================================
//  CACHE HELPERS
// ================================================================
function getCached(key) {
    return window.StorageManager.getApiData(key);
}

function setCache(key, data) {
    return window.StorageManager.saveApiData(key, data, API_CACHE_TTL);
}

function clearApiCache() {
    window.StorageManager.clearAllApiData();
}

// ================================================================
//  SUPABASE REST QUERY HELPER
// ================================================================
async function supabaseGet(path) {
    const settings = getSettings();
    let url = (settings.supabaseUrl || '').trim();
    const key = (settings.supabaseKey || '').trim();

    if (!url || !key) {
        throw new Error('Supabase not configured. Go to Settings and enter your URL and API Key.');
    }

    if (url.endsWith('/')) url = url.slice(0, -1);
    if (url.endsWith('/rest/v1')) url = url.slice(0, -8);

    const fullUrl = `${url}/rest/v1/${path}`;

    const response = await fetch(fullUrl, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error ${response.status}: ${errText}`);
    }

    return response.json();
}

// ================================================================
//  CONFIGURATION ENDPOINTS — Populate Dropdowns
// ================================================================

/**
 * GET /rest/v1/boards — all active boards
 * Returns: [{ id, name, display_order }]
 */
async function apiFetchBoards() {
    const cached = getCached('boards');
    if (cached) return cached;

    const data = await supabaseGet('boards?is_active=eq.true&order=display_order');
    setCache('boards', data);
    return data;
}

/**
 * GET /rest/v1/classes — all active class levels
 * Returns: [{ id, name, display_order }]
 */
async function apiFetchClasses() {
    const cached = getCached('classes');
    if (cached) return cached;

    const data = await supabaseGet('classes?is_active=eq.true&order=display_order');
    setCache('classes', data);
    return data;
}

/**
 * GET /rest/v1/subjects — all active subjects
 * Returns: [{ id, name, icon, folder_key, display_order }]
 */
async function apiFetchSubjects() {
    const cached = getCached('subjects');
    if (cached) return cached;

    const data = await supabaseGet('subjects?is_active=eq.true&order=display_order');
    setCache('subjects', data);
    return data;
}

// ================================================================
//  CURRICULUM CONTENT ENDPOINTS
// ================================================================

/**
 * GET chapters for a specific board/class/subject
 * Returns: [{ id, chapter_number, title, description, display_order }]
 */
async function apiFetchChapters(board, className, subject) {
    const cacheKey = `chapters_${board}_${className}_${subject}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
        'board': `eq.${board}`,
        'class': `eq.${className}`,
        'subject': `eq.${subject}`,
        'order': 'chapter_number'
    });

    const data = await supabaseGet(`chapters?${params}`);
    setCache(cacheKey, data);
    return data;
}

/**
 * GET a single chapter by ID
 * Returns: { id, chapter_number, title, description, board, class, subject }
 */
async function apiFetchChapter(chapterId) {
    const data = await supabaseGet(`chapters?id=eq.${chapterId}`);
    return data.length > 0 ? data[0] : null;
}

/**
 * GET modules for a chapter
 * Returns: [{ id, module_number, title, content_markdown, learning_objectives }]
 */
async function apiFetchModules(chapterId) {
    return await supabaseGet(`modules?chapter_id=eq.${chapterId}&order=module_number`);
}

/**
 * GET a single module by ID
 * Returns: { id, module_number, title, content_markdown, learning_objectives }
 */
async function apiFetchModule(moduleId) {
    const data = await supabaseGet(`modules?id=eq.${moduleId}`);
    return data.length > 0 ? data[0] : null;
}

/**
 * GET questions for a module
 * Returns: [{ id, question_type, question_text, options, difficulty }]
 */
async function apiFetchQuestions(moduleId) {
    return await supabaseGet(`questions?module_id=eq.${moduleId}&order=display_order`);
}

/**
 * GET questions for an entire chapter
 */
async function apiFetchChapterQuestions(chapterId) {
    return await supabaseGet(`questions?chapter_id=eq.${chapterId}&order=display_order`);
}

// ================================================================
//  TAG SEARCH ENDPOINTS — Powers #Ch1 autocomplete
// ================================================================

/**
 * GET all tags for a subject
 * Returns: [{ tag, label, entity_type, entity_id }]
 */
async function apiFetchTags(subject) {
    const cacheKey = `tags_${subject}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const params = subject
        ? `content_tags?subject=eq.${encodeURIComponent(subject)}&order=tag`
        : `content_tags?order=tag`;

    const data = await supabaseGet(params);
    setCache(cacheKey, data);
    return data;
}

/**
 * Search tags by query (for autocomplete)
 * Returns: [{ tag, label, entity_type, entity_id }]
 */
async function apiSearchTags(query, subject) {
    let params = `content_tags?tag=ilike.*${encodeURIComponent(query)}*&order=tag&limit=20`;
    if (subject) {
        params += `&subject=eq.${encodeURIComponent(subject)}`;
    }
    return await supabaseGet(params);
}

/**
 * Resolve a specific tag to its content
 * Returns: { tag, entity_type, entity_id, chapter/module data }
 */
async function apiResolveTag(tag) {
    const tagData = await supabaseGet(`content_tags?tag=eq.${encodeURIComponent(tag)}&limit=1`);
    if (!tagData || tagData.length === 0) return null;

    const entry = tagData[0];
    let content = null;

    if (entry.entity_type === 'chapter') {
        content = await apiFetchChapter(entry.entity_id);
    } else if (entry.entity_type === 'module') {
        content = await apiFetchModule(entry.entity_id);
    }

    return { ...entry, content };
}

// ================================================================
//  CONVENIENCE: Get flat tag list for autocomplete
//  Returns: string[] like ["Ch1_RealNumbers", "Ch2_Polynomials", ...]
// ================================================================
async function apiFetchFlatTags(subject) {
    const tags = await apiFetchTags(subject);
    return tags.map(t => t.tag);
}

// Expose globally
window.apiFetchBoards = apiFetchBoards;
window.apiFetchClasses = apiFetchClasses;
window.apiFetchSubjects = apiFetchSubjects;
window.apiFetchChapters = apiFetchChapters;
window.apiFetchChapter = apiFetchChapter;
window.apiFetchModules = apiFetchModules;
window.apiFetchModule = apiFetchModule;
window.apiFetchQuestions = apiFetchQuestions;
window.apiFetchTags = apiFetchTags;
window.apiSearchTags = apiSearchTags;
window.apiResolveTag = apiResolveTag;
window.apiFetchFlatTags = apiFetchFlatTags;
window.clearApiCache = clearApiCache;

async function fetchTopicsFromAPI() {
  console.log("fetchTopicsFromAPI called!");
  const statusEl = document.getElementById('fetchTopicsStatus');
  const btn = document.getElementById('fetchTopicsBtn');
  
  try {
    statusEl.textContent = 'Fetching...';
    btn.disabled = true;
    
    const settings = getSettings();
    const board = (settings.curriculumBoard || 'CBSE').toLowerCase();
    const className = (settings.curriculumClass || '10').toLowerCase();
    const rawSubject = (settings.curriculumSubject || 'Mathematics').toLowerCase();
    
    const subjectMap = {
        'mathematics': 'math',
        'math': 'math',
        'science': 'science',
        'social studies': 'social',
        'social': 'social',
        'telugu': 'telugu',
        'english': 'english',
        'hindi': 'hindi'
    };
    const subjectKey = subjectMap[rawSubject] || rawSubject;
    const apiUrl = `https://staticapis.pragament.com/lms/${board}/${className}/${subjectKey}/topics.json`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const topics = await response.json();
    
    // Save to local storage
    const storageKey = `curriculum_topics_${board}_${className}_${subjectKey}`;
    localStorage.setItem(storageKey, JSON.stringify(topics));
    
    statusEl.textContent = `✓ Saved ${topics.length} topics`;
    showToast(`Successfully fetched and saved ${topics.length} topics`, 'success');
    
    // Update the CURRICULUM_TAGS with the transformed API data
    const subject = getSettings().curriculumSubject || 'Mathematics';
    
    // Extract unique chapter names and clean them to create valid hashtags
    const uniqueChapters = Array.from(new Set(topics.map(t => t.chapterName)));
    const cleanTags = uniqueChapters.map(name => name.replace(/[^a-zA-Z0-9\u0C00-\u0C7F]/g, ''));
    
    window.CURRICULUM_TAGS = window.CURRICULUM_TAGS || {};
    window.CURRICULUM_TAGS[subject] = cleanTags;
    
    // Force set the tags cache key in localStorage so it takes effect instantly
    const cacheKey = `tags_${subject}`;
    const cacheData = cleanTags.map(tag => ({
        tag: tag,
        label: tag,
        entity_type: 'chapter',
        entity_id: 1,
        subject: subject
    }));
    
    window.StorageManager.saveApiData(cacheKey, cacheData, API_CACHE_TTL);
    
    window.isCurriculumFetched = true;
    
  } catch (error) {
    console.error('Error fetching topics:', error);
    statusEl.textContent = '✗ Failed to fetch';
    showToast('Failed to fetch topics: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

window.fetchTopicsFromAPI = fetchTopicsFromAPI;/**
 * Fetch Supabase configuration from nameserver API
 * @param {string} uuid
 * @param {string} pin
 * @returns {Promise<{supabaseUrl: string, supabaseAnonKey: string, tableName: string}>}
 */
async function apiFetchSupabaseConfig(uuid, pin) {
    const url = 'https://expressjs-api-intranet-nameserver.onrender.com/api/config/get';
    
    // Validate pin is present
    if (!pin || pin.trim() === '') {
        throw new Error('PIN is required.');
    }
    
    const payload = {
        uuid: uuid ? uuid.trim() : "",
        pin: pin.trim()
    };
    
    // Developer Logging (development mode only)
    console.group('Developer Logs: Fetch Config Request');
    console.log('Request Payload:', payload);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        console.log('HTTP Status Code:', response.status);
        
        if (!response.ok) {
            let errorMsg = `Server returned status ${response.status}`;
            try {
                const errData = await response.json();
                console.log('Raw Error response:', errData);
                if (errData && errData.message) {
                    errorMsg = errData.message;
                } else if (errData && errData.error) {
                    errorMsg = errData.error;
                }
            } catch (e) {
                // response is not JSON
            }
            console.groupEnd();
            throw new Error(errorMsg);
        }
        
        const rawData = await response.json();
        console.log('Raw API Response (JSON):', JSON.stringify(rawData, null, 2));
        
        if (!rawData) {
            console.groupEnd();
            throw new Error('Server returned an empty response.');
        }
        
        // Resolve nested target config object if it exists (Format 2: rawData.data, Format 3: rawData.config)
        let target = rawData;
        if (rawData.config && typeof rawData.config === 'object') {
            target = rawData.config;
        } else if (rawData.data && typeof rawData.data === 'object') {
            target = rawData.data;
        }
        
        // Resolve URL, key, and table name keys from target object
        const supabaseUrl = target.supabaseUrl || target.supabase_url || target.url || target.SUPABASE_URL;
        const supabaseAnonKey = target.supabaseAnonKey || target.supabase_anon_key || target.anonKey || target.anon_key || target.key || target.SUPABASE_ANON_KEY;
        const tableName = target.tableName || target.table_name || target.table || target.SUPABASE_TABLE || 'daily_activities';
        
        console.log('Parsed Credentials (JSON):', JSON.stringify({ supabaseUrl, supabaseAnonKey, tableName }, null, 2));
        
        if (!supabaseUrl || !supabaseAnonKey) {
            // Log missing required fields precisely
            const missing = [];
            if (!supabaseUrl) missing.push('supabaseUrl');
            if (!supabaseAnonKey) missing.push('supabaseAnonKey');
            
            console.error('Missing Required Fields:', JSON.stringify(missing));
            console.error('Failed Response Payload:', JSON.stringify(rawData));
            console.groupEnd();
            
            throw new Error(`Server response is missing required fields: ${missing.join(', ')}`);
        }
        
        console.groupEnd();
        return { supabaseUrl, supabaseAnonKey, tableName };
    } catch (error) {
        console.error('apiFetchSupabaseConfig failed:', error);
        console.groupEnd();
        throw error;
    }
}

window.apiFetchSupabaseConfig = apiFetchSupabaseConfig;
