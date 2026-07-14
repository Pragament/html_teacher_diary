// ================================================================
//  TAGS AUTOCOMPLETE SERVICE
// ================================================================
let activeDropdown = null;
let activeIndex = -1;
let currentInput = null;
let currentMatchStart = -1;

function getUserSubject() {
    return localStorage.getItem('userSubject') || '';
}

async function getFilteredTags(query, input) {
    const settings = getSettings();
    const rawSubject = (settings.curriculumSubject || getUserSubject() || 'Mathematics').trim().toLowerCase();
    
    // Determine the class from the current row in the Daily Entry table
    const tr = input ? input.closest('tr') : null;
    const classDropdown = tr ? tr.querySelector('.daily-class-dropdown') : null;
    const selectedClass = classDropdown ? classDropdown.value.trim() : '';
    
    const boardKey = (settings.curriculumBoard || 'CBSE').toLowerCase();
    const classKey = (selectedClass || settings.curriculumClass || '10').trim().toLowerCase();
    
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
    
    // Check local storage directly for the requested board/class/subject topics
    const storageKey = `curriculum_topics_${boardKey}_${classKey}_${subjectKey}`;
    let storedTopics = localStorage.getItem(storageKey);
    
    // If not cached in local storage, fetch directly from the static API
    if (!storedTopics) {
        const apiUrl = `https://staticapis.pragament.com/lms/${boardKey}/${classKey}/${subjectKey}/topics.json`;
        console.log(`Autocomplete: topics not cached. Fetching directly from API: ${apiUrl}`);
        try {
            const response = await fetch(apiUrl);
            if (response.ok) {
                const topics = await response.json();
                console.log("Autocomplete: Fetched curriculum topics from API:", topics);
                localStorage.setItem(storageKey, JSON.stringify(topics));
                storedTopics = JSON.stringify(topics);
                console.log(`Autocomplete: Successfully fetched and saved topics to local storage.`);
            }
        } catch (fetchErr) {
            console.warn(`Autocomplete: failed to fetch topics dynamically from ${apiUrl}`, fetchErr);
        }
    }
    
    let subjectTags = [];
    if (storedTopics) {
        try {
            const topics = JSON.parse(storedTopics);
            if (Array.isArray(topics)) {
                const uniqueChapters = Array.from(new Set(topics.map(t => t.chapterName || t.chapter_name)));
                subjectTags = uniqueChapters.map(name => name.replace(/[^a-zA-Z0-9\u0C00-\u0C7F]/g, ''));
            }
        } catch (e) {
            console.error('Failed to parse cached topics for', storageKey, e);
        }
    }
    
    // Fallback: If local storage has no topics cached for this class, fall back to CURRICULUM_TAGS or fetch API
    if (subjectTags.length === 0) {
        const tagsData = await fetchCurriculumTagsAPI(rawSubject);
        Object.keys(tagsData).forEach(key => {
            if (key.toLowerCase() === rawSubject) {
                subjectTags = tagsData[key];
            }
        });
    }
    
    // Filter suggestions based on query
    if (subjectTags.length > 0) {
        if (!query) return subjectTags;
        const lowerQuery = query.toLowerCase();
        return subjectTags.filter(t => t.toLowerCase().includes(lowerQuery));
    }
    
    // Global fallback search
    const tagsData = await fetchCurriculumTagsAPI('');
    let allTags = [];
    Object.keys(tagsData).forEach(key => {
        allTags = allTags.concat(tagsData[key]);
    });
    allTags = Array.from(new Set(allTags));
    
    if (!query) return allTags;
    const lowerQuery = query.toLowerCase();
    return allTags.filter(t => t.toLowerCase().includes(lowerQuery));
}

function removeDropdown() {
    if (activeDropdown) {
        activeDropdown.remove();
        activeDropdown = null;
    }
    activeIndex = -1;
    currentInput = null;
    currentMatchStart = -1;
}

function positionDropdown(input, dropdown) {
    const rect = input.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Position just below the input field
    dropdown.style.left = `${rect.left + scrollLeft}px`;
    dropdown.style.top = `${rect.bottom + scrollTop + 4}px`;
    dropdown.style.width = `${Math.max(rect.width, 200)}px`;
}

async function handleTagAutocompleteInput(input) {
    const cursorPos = input.selectionStart;
    const textBeforeCursor = input.value.substring(0, cursorPos);
    
    // Match # followed by word characters (or Telugu/Unicode chars) up to the cursor
    const match = textBeforeCursor.match(/#([^\s#]*)$/);
    
    if (!match) {
        removeDropdown();
        return;
    }
    
    const query = match[1];
    currentInput = input;
    currentMatchStart = cursorPos - match[0].length;
    
    const filteredTags = await getFilteredTags(query, input);
    
    if (filteredTags.length === 0) {
        removeDropdown();
        return;
    }
    
    if (!activeDropdown) {
        activeDropdown = document.createElement('div');
        activeDropdown.className = 'autocomplete-dropdown';
        document.body.appendChild(activeDropdown);
    }
    
    activeDropdown.innerHTML = '';
    activeIndex = 0;
    
    filteredTags.forEach((tag, idx) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item' + (idx === 0 ? ' active' : '');
        item.textContent = `#${tag}`;
        item.addEventListener('click', () => {
            selectTag(tag);
        });
        activeDropdown.appendChild(item);
    });
    
    positionDropdown(input, activeDropdown);
}

function selectTag(tag) {
    if (!currentInput || currentMatchStart === -1) return;
    
    const input = currentInput;
    const val = input.value;
    const cursorPos = input.selectionStart;
    
    // Replace from currentMatchStart to cursorPos with the selected tag
    const before = val.substring(0, currentMatchStart);
    const after = val.substring(cursorPos);
    
    input.value = `${before}#${tag} ${after}`;
    
    // Put cursor right after the tag and space
    const newCursorPos = currentMatchStart + tag.length + 2;
    input.setSelectionRange(newCursorPos, newCursorPos);
    
    removeDropdown();
    input.focus();
    
    // Trigger input event to make sure any height auto-adjust or change listeners run
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function handleTagAutocompleteKeydown(e, input) {
    if (!activeDropdown) return;
    
    const items = activeDropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[activeIndex].classList.remove('active');
        activeIndex = (activeIndex + 1) % items.length;
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[activeIndex].classList.remove('active');
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const activeItem = items[activeIndex];
        if (activeItem) {
            // Extract the tag name (remove leading #)
            const tag = activeItem.textContent.substring(1);
            selectTag(tag);
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        removeDropdown();
    }
}

// Global Event Listeners using Delegation
document.addEventListener('input', function(e) {
    if (e.target.classList.contains('daily-work') || e.target.classList.contains('daily-home')) {
        handleTagAutocompleteInput(e.target);
    }
});

document.addEventListener('keydown', function(e) {
    if (e.target.classList.contains('daily-work') || e.target.classList.contains('daily-home')) {
        handleTagAutocompleteKeydown(e, e.target);
    }
});

// Close dropdown on click outside
document.addEventListener('click', function(e) {
    if (activeDropdown && !activeDropdown.contains(e.target) && e.target !== currentInput) {
        removeDropdown();
    }
});
