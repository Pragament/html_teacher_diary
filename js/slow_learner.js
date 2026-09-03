// ================================================================
//  SLOW LEARNER PROGRESS MONITORING SCRIPT
// ================================================================

function generateUUID() {
    return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'sl-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function getTodayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function getSlowLearnerStorageKey() {
    let uid = 'offline';
    if (window.getSupabaseClient) {
        const client = window.getSupabaseClient();
        if (client) {
            const { data: { session } } = await client.auth.getSession();
            if (session?.user?.id) uid = session.user.id;
        }
    }
    return `slow_learner_entries_${uid}`;
}

async function getSlowLearnerEntries() {
    // 1. Try to fetch from Supabase if online
    if (window.fetchSlowLearnerFromSupabase && localStorage.getItem('offlineMode') !== 'true') {
        const result = await window.fetchSlowLearnerFromSupabase();
        if (result.ok && result.data && result.data.length > 0) {
            await saveSlowLearnerEntriesLocally(result.data);
            return result.data;
        }
    }
    
    // 2. Fallback to local storage
    const key = await getSlowLearnerStorageKey();
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch (e) {
        console.error('Error fetching slow learner entries', e);
        return [];
    }
}

async function saveSlowLearnerEntriesLocally(entries) {
    try {
        const key = await getSlowLearnerStorageKey();
        localStorage.setItem(key, JSON.stringify(entries));
    } catch (e) {
        console.error('Error saving slow learner entries locally', e);
    }
}

function updateSlDateSubtitle() {
    const input = document.getElementById('slHeaderDateInput');
    const subtitle = document.getElementById('slModalDateSubtitle');
    if (!input || !subtitle) return;
    const dateVal = input.value || getTodayStr();
    const dateObj = new Date(dateVal);
    const dateFormatted = isNaN(dateObj) ? dateVal : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    subtitle.textContent = `Date: ${dateFormatted} — Progress Monitoring Record`;
}

function renderModalRows(entries) {
    const container = document.getElementById('slModalRowsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!entries || entries.length === 0) {
        for (let i = 0; i < 5; i++) {
            addSlowLearnerRow();
        }
        return;
    }

    entries.forEach(entry => addSlowLearnerRow(entry));
}

function addSlowLearnerRow(data = {}) {
    const container = document.getElementById('slModalRowsContainer');
    if (!container) return;

    const defaultDate = data.date || (document.getElementById('slHeaderDateInput')?.value) || getTodayStr();
    const tr = document.createElement('tr');
    tr.className = 'sl-row-item';
    tr.setAttribute('data-id', escapeHtml(data.id || ''));

    const classOpts = [1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}" ${data.className === String(n) ? 'selected' : ''}>${n}</option>`).join('');
    
    tr.innerHTML = `
        <td>
            <input type="date" class="sl-input sl-input-date" value="${escapeHtml(defaultDate)}" />
        </td>
        <td>
            <select class="sl-input sl-input-class"><option value="">-</option>${classOpts}</select>
        </td>
        <td>
            <input type="text" class="sl-input sl-input-section" placeholder="Sec" value="${escapeHtml(data.section || '')}" />
        </td>
        <td>
            <div style="display: flex; align-items: center; gap: 4px; position: relative;">
                <input type="text" class="sl-input sl-input-name" placeholder="Enter student name... (Type # to search)" value="${escapeHtml(data.studentName || '')}" oninput="handleStudentSearchInput(this)" onkeydown="handleStudentSearchKeydown(event, this)" autocomplete="off" />
            </div>
        </td>
        <td>
            <div style="display: flex; align-items: center; gap: 4px; position: relative;">
                <input type="text" class="sl-input sl-input-subject" placeholder="Subject... (Type # to search)" value="${escapeHtml(data.subject || '')}" oninput="handleSubjectSearchInput(this)" onkeydown="handleStudentSearchKeydown(event, this)" autocomplete="off" />
            </div>
        </td>
        <td>
            <textarea class="sl-input sl-textarea-gap" rows="2" placeholder="Describe learning gap...">${escapeHtml(data.learningGap || '')}</textarea>
        </td>
        <td>
            <textarea class="sl-input sl-textarea-strategy" rows="2" placeholder="Strategy/Method used...">${escapeHtml(data.strategy || '')}</textarea>
        </td>
        <td>
            <select class="sl-input sl-select-progress">
                <option value="" ${!data.progress ? 'selected' : ''}>-- Select Progress --</option>
                <option value="Improving" ${data.progress === 'Improving' ? 'selected' : ''}>Improving</option>
                <option value="Satisfactory" ${data.progress === 'Satisfactory' ? 'selected' : ''}>Satisfactory</option>
                <option value="Little Improvement" ${data.progress === 'Little Improvement' ? 'selected' : ''}>Little Improvement</option>
                <option value="Needs Attention" ${data.progress === 'Needs Attention' ? 'selected' : ''}>Needs Attention</option>
            </select>
        </td>
        <td>
            <textarea class="sl-input sl-textarea-nextstep" rows="2" placeholder="Next step or action plan...">${escapeHtml(data.nextStep || '')}</textarea>
        </td>
        <td style="text-align: center;">
            <button type="button" class="btn-sl-delete" onclick="removeSlowLearnerRow(this)" title="Delete Row">
                🗑
            </button>
        </td>
    `;

    container.appendChild(tr);
}

function removeSlowLearnerRow(btn) {
    const tr = btn.closest('tr');
    if (tr) tr.remove();
}

function clearAllSlowLearnerRows() {
    if (!confirm('Are you sure you want to clear all rows?')) return;
    const container = document.getElementById('slModalRowsContainer');
    if (container) container.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        addSlowLearnerRow();
    }
}

async function saveAllSlowLearnerRows(redirectOnSave = true) {
    const rows = document.querySelectorAll('#slModalRowsContainer tr.sl-row-item');
    const entries = [];

    rows.forEach((tr, idx) => {
        const date = tr.querySelector('.sl-input-date')?.value || '';
        const className = tr.querySelector('.sl-input-class')?.value || '';
        const section = tr.querySelector('.sl-input-section')?.value.trim() || '';
        const studentName = tr.querySelector('.sl-input-name')?.value.trim() || '';
        const subject = tr.querySelector('.sl-input-subject')?.value.trim() || '';
        const learningGap = tr.querySelector('.sl-textarea-gap')?.value.trim() || '';
        const strategy = tr.querySelector('.sl-textarea-strategy')?.value.trim() || '';
        const progress = tr.querySelector('.sl-select-progress')?.value || '';
        const nextStep = tr.querySelector('.sl-textarea-nextstep')?.value.trim() || '';

        entries.push({
            id: tr.getAttribute('data-id') || generateUUID(),
            date,
            className,
            section,
            studentName,
            subject,
            learningGap,
            strategy,
            progress,
            nextStep
        });
    });

    await saveSlowLearnerEntriesLocally(entries);
    
    let syncMsg = 'Saved locally.';
    if (window.syncSlowLearnerToSupabase && localStorage.getItem('offlineMode') !== 'true') {
        const syncResult = await window.syncSlowLearnerToSupabase(entries);
        if (syncResult.ok) {
            syncMsg = 'Synced to Supabase.';
        } else {
            console.error('Supabase sync failed:', syncResult.error);
            syncMsg = 'Saved locally (Sync pending).';
        }
    }

    if (typeof showToast === 'function') showToast(`💾 Slow Learner records saved! ${syncMsg}`, 'success');
    
    if (redirectOnSave || window.location.pathname.endsWith('slow_learner.html')) {
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1200);
    }
}

function exportSlowLearnerCSV() {
    const rows = document.querySelectorAll('#slModalRowsContainer tr.sl-row-item');
    let entries = [];

    if (rows.length > 0) {
        rows.forEach(tr => {
            const date = tr.querySelector('.sl-input-date')?.value || '';
            const className = tr.querySelector('.sl-input-class')?.value || '';
            const section = tr.querySelector('.sl-input-section')?.value.trim() || '';
            const studentName = tr.querySelector('.sl-input-name')?.value.trim() || '';
            const subject = tr.querySelector('.sl-input-subject')?.value.trim() || '';
            const learningGap = tr.querySelector('.sl-textarea-gap')?.value.trim() || '';
            const strategy = tr.querySelector('.sl-textarea-strategy')?.value.trim() || '';
            const progress = tr.querySelector('.sl-select-progress')?.value || '';
            const nextStep = tr.querySelector('.sl-textarea-nextstep')?.value.trim() || '';

            entries.push({ date, className, section, studentName, subject, learningGap, strategy, progress, nextStep });
        });
    } else {
        // Will only grab whatever was already parsed. If empty, getSlowLearnerEntries is async so we can't do this easily.
        // It's fine for now. If table is empty, we just export nothing.
    }

    if (entries.length === 0) {
        if (typeof showToast === 'function') showToast('No records to export', 'warning');
        return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Date,Class,Section,Student Name,Subject,Learning Gap,Strategy/Method Used,Progress,Next Step\n';

    entries.forEach(row => {
        const line = [
            `"${(row.date || '').replace(/"/g, '""')}"`,
            `"${(row.className || '').replace(/"/g, '""')}"`,
            `"${(row.section || '').replace(/"/g, '""')}"`,
            `"${(row.studentName || '').replace(/"/g, '""')}"`,
            `"${(row.subject || '').replace(/"/g, '""')}"`,
            `"${(row.learningGap || '').replace(/"/g, '""')}"`,
            `"${(row.strategy || '').replace(/"/g, '""')}"`,
            `"${(row.progress || '').replace(/"/g, '""')}"`,
            `"${(row.nextStep || '').replace(/"/g, '""')}"`
        ].join(',');
        csvContent += line + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `slow_learner_progress_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Expose functions globally
window.getSlowLearnerEntries = getSlowLearnerEntries;
window.saveSlowLearnerEntriesLocally = saveSlowLearnerEntriesLocally;
window.addSlowLearnerRow = addSlowLearnerRow;
window.removeSlowLearnerRow = removeSlowLearnerRow;
window.clearAllSlowLearnerRows = clearAllSlowLearnerRows;
window.saveAllSlowLearnerRows = saveAllSlowLearnerRows;
window.updateSlDateSubtitle = updateSlDateSubtitle;
window.exportSlowLearnerCSV = exportSlowLearnerCSV;
window.renderModalRows = renderModalRows;
window.getTodayStr = getTodayStr;

// ================================================================
//  STUDENT SEARCH (AUTOCOMPLETE)
// ================================================================

function getGlobalDropdown() {
    let dropdown = document.getElementById('globalStudentDropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'globalStudentDropdown';
        dropdown.className = 'student-autocomplete-dropdown';
        dropdown.style.display = 'none';
        document.body.appendChild(dropdown);
        
        // Hide on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#globalStudentDropdown') && 
                !e.target.classList.contains('sl-input-name') &&
                !e.target.classList.contains('sl-input-subject')) {
                dropdown.style.display = 'none';
            }
        });
    }
    return dropdown;
}

function handleStudentSearchInput(input) {
    const tr = input.closest('tr');
    const dropdown = getGlobalDropdown();
    const val = input.value;
    
    if (!val.startsWith('#')) {
        dropdown.style.display = 'none';
        return;
    }
    
    // Position dropdown below input correctly, relative to document
    const rect = input.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    dropdown.style.left = (rect.left + window.scrollX) + 'px';
    dropdown.style.width = rect.width + 'px';
    
    if (!window.studentsDBReady) {
        dropdown.innerHTML = '<div class="autocomplete-empty">⏳ Loading student list...</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    const search = val.slice(1).trim().toLowerCase();
    
    const rowClass = tr.querySelector('.sl-input-class')?.value || '';
    const rowSec = tr.querySelector('.sl-input-section')?.value.trim().toLowerCase() || '';
    
    if (!rowClass || !rowSec) {
        dropdown.innerHTML = '<div class="autocomplete-empty">Select Class and Section<br>to search students.</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    let matches = window.studentsDB || [];
    matches = matches.filter(s => s.class == rowClass);
    matches = matches.filter(s => s.section.toLowerCase() === rowSec);
    
    if (search) {
        matches = matches.filter(s => s.name.toLowerCase().includes(search));
    }
    
    if (matches.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-empty">No students found</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    dropdown.innerHTML = '';

    const header = document.createElement('div');
    header.style.padding = '8px 12px';
    header.style.fontSize = '11px';
    header.style.fontWeight = '700';
    header.style.color = 'var(--sl-text-accent)';
    header.style.textTransform = 'uppercase';
    header.style.letterSpacing = '0.5px';
    header.style.borderBottom = '1px solid var(--sl-border)';
    header.style.marginBottom = '4px';
    header.innerHTML = `🔎 Search Class ${rowClass}-${rowSec.toUpperCase()} Students`;
    dropdown.appendChild(header);

    // show matches
    matches.forEach(student => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = `<span style="opacity:0.5; width:20px; display:inline-block;">${student.rollNo || ''}</span> ${student.name}`;
        
        item.onmousedown = (e) => {
            e.preventDefault(); // prevent blur
            input.value = student.name;
            dropdown.style.display = 'none';
        };
        
        item.addEventListener('mouseenter', () => {
            const items = dropdown.querySelectorAll('.autocomplete-item');
            items.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
        
        dropdown.appendChild(item);
    });
    dropdown.style.display = 'block';
}

const DEFAULT_SUBJECTS = [
    'Mathematics', 'Science', 'English', 'Social Studies', 'Hindi', 
    'Physics', 'Chemistry', 'Biology', 'Computer Science'
];

function handleSubjectSearchInput(input) {
    const dropdown = getGlobalDropdown();
    const val = input.value;
    
    if (!val.startsWith('#')) {
        dropdown.style.display = 'none';
        return;
    }
    
    const rect = input.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    dropdown.style.left = (rect.left + window.scrollX) + 'px';
    dropdown.style.width = rect.width + 'px';
    
    const search = val.slice(1).trim().toLowerCase();
    
    let matches = DEFAULT_SUBJECTS;
    if (search) {
        matches = matches.filter(s => s.toLowerCase().includes(search));
    }
    
    if (matches.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-empty">No subjects found</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    dropdown.innerHTML = '';
    
    const header = document.createElement('div');
    header.style.padding = '8px 12px';
    header.style.fontSize = '11px';
    header.style.fontWeight = '700';
    header.style.color = 'var(--sl-text-accent)';
    header.style.textTransform = 'uppercase';
    header.style.letterSpacing = '0.5px';
    header.style.borderBottom = '1px solid var(--sl-border)';
    header.style.marginBottom = '4px';
    header.innerHTML = `🔎 Search Subjects`;
    dropdown.appendChild(header);

    matches.forEach(subject => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = subject;
        
        item.onmousedown = (e) => {
            e.preventDefault(); 
            input.value = subject;
            dropdown.style.display = 'none';
        };
        
        item.addEventListener('mouseenter', () => {
            const items = dropdown.querySelectorAll('.autocomplete-item');
            items.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
        
        dropdown.appendChild(item);
    });
    dropdown.style.display = 'block';
}

function handleStudentSearchKeydown(event, input) {
    const dropdown = document.getElementById('globalStudentDropdown');
    if (!dropdown || dropdown.style.display === 'none') return;
    
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;
    
    let activeIdx = Array.from(items).findIndex(i => i.classList.contains('active'));
    
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (activeIdx < items.length - 1) activeIdx++;
        else activeIdx = 0;
        items.forEach(i => i.classList.remove('active'));
        items[activeIdx].classList.add('active');
        items[activeIdx].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (activeIdx > 0) activeIdx--;
        else activeIdx = items.length - 1;
        items.forEach(i => i.classList.remove('active'));
        items[activeIdx].classList.add('active');
        items[activeIdx].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (activeIdx >= 0 && activeIdx < items.length) {
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            items[activeIdx].dispatchEvent(mousedownEvent);
        }
    } else if (event.key === 'Escape') {
        dropdown.style.display = 'none';
    }
}

// Add to window
window.handleStudentSearchInput = handleStudentSearchInput;
window.handleSubjectSearchInput = handleSubjectSearchInput;
window.handleStudentSearchKeydown = handleStudentSearchKeydown;
