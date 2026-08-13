// ================================================================
//  CURRICULUM TAGS — populated ONLY from API, never hardcoded
// ================================================================
window.CURRICULUM_TAGS = {};

window.isCurriculumFetched = false;

// ================================================================
//  MAIN LOADER — fetches curriculum tags via API URLs
// ================================================================
async function loadCurriculumCSV(force = false) {
    if (window.isCurriculumFetched && !force) return;

    const banner = document.getElementById('curriculum-status-banner');
    const text = document.getElementById('curriculum-status-text');
    const retryBtn = document.getElementById('curriculum-retry-btn');

    if (banner) {
        banner.className = 'curriculum-status-banner loading';
        text.textContent = '🔄 Loading curriculum from API...';
        if (retryBtn) retryBtn.classList.add('hidden');
        banner.classList.remove('hidden');
    }

    const settings = getSettings();
    const board = settings.curriculumBoard || 'CBSE';
    const className = settings.curriculumClass || '10';
    const subject = settings.curriculumSubject || 'Mathematics';

    console.log(`Curriculum: fetching tags from API → board=${board}, class=${className}, subject=${subject}`);

    try {
        const boardKey = board.toLowerCase();
        const classKey = className.toLowerCase();
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
        const subjectKey = subjectMap[subject.toLowerCase()] || subject.toLowerCase();
        const apiUrl = `https://staticapis.pragament.com/lms/${boardKey}/${classKey}/${subjectKey}/topics.json`;
        const storageKey = `curriculum_topics_${boardKey}_${classKey}_${subjectKey}`;

        // Automatically check if stored topics exist. If not, fetch them from the URL!
        let storedTopics = localStorage.getItem(storageKey);
        if (!storedTopics || force) {
            console.log(`Curriculum: No cached topics. Fetching from API: ${apiUrl}`);
            try {
                const response = await fetch(apiUrl);
                if (response.ok) {
                    const topics = await response.json();
                    console.log("Curriculum: Fetched curriculum topics from API:", topics);
                    localStorage.setItem(storageKey, JSON.stringify(topics));
                    storedTopics = JSON.stringify(topics);
                } else {
                    throw new Error(`Live API returned non-OK status: ${response.status}`);
                }
            } catch (err) {
                // console.warn("Live API fetch failed.", err);
            }
        }

        let tags = [];
        if (storedTopics) {
            const topics = JSON.parse(storedTopics);
            const uniqueChapters = Array.from(new Set(topics.map(t => t.chapterName || t.chapter_name)));
            tags = uniqueChapters.map(name => name.replace(/[^a-zA-Z0-9\u0C00-\u0C7F]/g, ''));
        }

        if (tags.length > 0) {
            window.CURRICULUM_TAGS[subject] = tags;
        } else {
            // Fallback: Fetch tags from database via API URL
            const dbTags = await apiFetchFlatTags(subject);
            if (dbTags && dbTags.length > 0) {
                window.CURRICULUM_TAGS[subject] = dbTags;
            } else {
                const chapters = await apiFetchChapters(board, className, subject);
                if (chapters && chapters.length > 0) {
                    const builtTags = [];
                    for (const ch of chapters) {
                        const cleanTitle = ch.title.replace(/[^a-zA-Z0-9\u0C00-\u0C7F]/g, '');
                        builtTags.push(cleanTitle);
                    }
                    window.CURRICULUM_TAGS[subject] = builtTags;
                } else {
                    window.CURRICULUM_TAGS[subject] = [];
                }
            }
        }

        window.isCurriculumFetched = true;
        const count = (window.CURRICULUM_TAGS[subject] || []).length;

        if (banner) {
            if (count > 0) {
                banner.className = 'curriculum-status-banner success';
                text.textContent = `✅ Loaded ${count} ${subject} tags from API.`;
                setTimeout(() => { banner.classList.add('hidden'); }, 4000);
            } else {
                banner.className = 'curriculum-status-banner error';
                text.textContent = `⚠️ No curriculum data found for ${board} Class ${className} ${subject}. Ask admin to seed the database.`;
                if (retryBtn) retryBtn.classList.remove('hidden');
            }
        }
    } catch (err) {
        // console.error('Failed to load curriculum from API:', err);
        window.isCurriculumFetched = true;

        if (banner) {
            banner.className = 'curriculum-status-banner error';
            text.textContent = `⚠️ API error: ${err.message}`;
            if (retryBtn) retryBtn.classList.remove('hidden');
            banner.classList.remove('hidden');
        }
    }
}

// ================================================================
//  CURRICULUM API HELPER — used by autocomplete
// ================================================================
async function fetchCurriculumTagsAPI(subject = '') {
    await loadCurriculumCSV();

    const data = window.CURRICULUM_TAGS || {};

    if (subject) {
        const normalizedSubject = subject.trim().toLowerCase();
        const key = Object.keys(data).find(k => k.toLowerCase() === normalizedSubject);
        if (key) {
            return { [key]: data[key] };
        }
    }
    return data;
}

// ================================================================
//  SEED DATABASE (kept for backward compat, now uses API data)
// ================================================================
async function seedDatabaseCurriculum() {
    const settings = getSettings();
    if (!settings.supabaseUrl || !settings.supabaseKey) {
        showToast('❌ Supabase credentials required! Please enter both Supabase URL and API Key in settings.', 'error');
        return;
    }
    showToast('ℹ️ Content is now managed via the database. Use Supabase SQL Editor to add new curriculum data.', 'info');
}
