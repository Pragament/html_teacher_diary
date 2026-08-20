// ================================================================
//  SLOW LEARNER PROGRESS MONITORING SCRIPT
// ================================================================

const SLOW_LEARNER_STORAGE_KEY = 'slow_learner_entries';

const DEFAULT_SLOW_LEARNER_ENTRIES = [
    { id: 'sl-1', date: '2026-08-18', studentName: '', subject: '', learningGap: '', strategy: '', progress: '', nextStep: '' },
    { id: 'sl-2', date: '2026-08-18', studentName: '', subject: '', learningGap: '', strategy: '', progress: '', nextStep: '' },
    { id: 'sl-3', date: '2026-08-18', studentName: '', subject: '', learningGap: '', strategy: '', progress: '', nextStep: '' },
    { id: 'sl-4', date: '2026-08-18', studentName: '', subject: '', learningGap: '', strategy: '', progress: '', nextStep: '' },
    { id: 'sl-5', date: '2026-08-18', studentName: '', subject: '', learningGap: '', strategy: '', progress: '', nextStep: '' }
];

function getSlowLearnerEntries() {
    try {
        const raw = localStorage.getItem(SLOW_LEARNER_STORAGE_KEY);
        if (!raw) {
            localStorage.setItem(SLOW_LEARNER_STORAGE_KEY, JSON.stringify(DEFAULT_SLOW_LEARNER_ENTRIES));
            return DEFAULT_SLOW_LEARNER_ENTRIES;
        }
        const parsed = JSON.parse(raw);
        // Clear old sample student data if present
        if (Array.isArray(parsed) && parsed.some(e => e.studentName === 'P. Marveth Sai' || e.studentName === 'Haavesh Nardhan' || e.studentName === 'V. Shiva')) {
            localStorage.setItem(SLOW_LEARNER_STORAGE_KEY, JSON.stringify(DEFAULT_SLOW_LEARNER_ENTRIES));
            return DEFAULT_SLOW_LEARNER_ENTRIES;
        }
        return parsed;
    } catch (e) {
        console.error('Error fetching slow learner entries', e);
        return DEFAULT_SLOW_LEARNER_ENTRIES;
    }
}

function saveSlowLearnerEntries(entries) {
    try {
        localStorage.setItem(SLOW_LEARNER_STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
        console.error('Error saving slow learner entries', e);
    }
}

function updateSlDateSubtitle() {
    const input = document.getElementById('slHeaderDateInput');
    const subtitle = document.getElementById('slModalDateSubtitle');
    if (!input || !subtitle) return;
    const dateVal = input.value || '2026-08-18';
    const dateObj = new Date(dateVal);
    const dateFormatted = isNaN(dateObj) ? 'Tue, Aug 18, 2026' : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
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

    const defaultDate = data.date || (document.getElementById('slHeaderDateInput')?.value) || '2026-08-18';
    const tr = document.createElement('tr');
    tr.className = 'sl-row-item';

    tr.innerHTML = `
        <td>
            <input type="date" class="sl-input sl-input-date" value="${escapeHtml(defaultDate)}" />
        </td>
        <td>
            <input type="text" class="sl-input sl-input-name" placeholder="Enter student name..." value="${escapeHtml(data.studentName || '')}" />
        </td>
        <td>
            <input type="text" class="sl-input sl-input-subject" placeholder="Subject..." value="${escapeHtml(data.subject || '')}" />
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

function saveAllSlowLearnerRows(redirectOnSave = true) {
    const rows = document.querySelectorAll('#slModalRowsContainer tr.sl-row-item');
    const entries = [];

    rows.forEach((tr, idx) => {
        const date = tr.querySelector('.sl-input-date')?.value || '';
        const studentName = tr.querySelector('.sl-input-name')?.value.trim() || '';
        const subject = tr.querySelector('.sl-input-subject')?.value.trim() || '';
        const learningGap = tr.querySelector('.sl-textarea-gap')?.value.trim() || '';
        const strategy = tr.querySelector('.sl-textarea-strategy')?.value.trim() || '';
        const progress = tr.querySelector('.sl-select-progress')?.value || '';
        const nextStep = tr.querySelector('.sl-textarea-nextstep')?.value.trim() || '';

        entries.push({
            id: 'sl-' + (idx + 1) + '-' + Date.now(),
            date,
            studentName,
            subject,
            learningGap,
            strategy,
            progress,
            nextStep
        });
    });

    saveSlowLearnerEntries(entries);
    if (typeof showToast === 'function') showToast('💾 Slow Learner records saved successfully!', 'success');
    
    if (redirectOnSave || window.location.pathname.endsWith('slow_learner.html')) {
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 300);
    }
}

function exportSlowLearnerCSV() {
    const rows = document.querySelectorAll('#slModalRowsContainer tr.sl-row-item');
    let entries = [];

    if (rows.length > 0) {
        rows.forEach(tr => {
            const date = tr.querySelector('.sl-input-date')?.value || '';
            const studentName = tr.querySelector('.sl-input-name')?.value.trim() || '';
            const subject = tr.querySelector('.sl-input-subject')?.value.trim() || '';
            const learningGap = tr.querySelector('.sl-textarea-gap')?.value.trim() || '';
            const strategy = tr.querySelector('.sl-textarea-strategy')?.value.trim() || '';
            const progress = tr.querySelector('.sl-select-progress')?.value || '';
            const nextStep = tr.querySelector('.sl-textarea-nextstep')?.value.trim() || '';

            entries.push({ date, studentName, subject, learningGap, strategy, progress, nextStep });
        });
    } else {
        entries = getSlowLearnerEntries();
    }

    if (entries.length === 0) {
        if (typeof showToast === 'function') showToast('No records to export', 'warning');
        return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Date,Student Name,Subject,Learning Gap,Strategy/Method Used,Progress,Next Step\n';

    entries.forEach(row => {
        const line = [
            `"${(row.date || '').replace(/"/g, '""')}"`,
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
window.saveSlowLearnerEntries = saveSlowLearnerEntries;
window.addSlowLearnerRow = addSlowLearnerRow;
window.removeSlowLearnerRow = removeSlowLearnerRow;
window.clearAllSlowLearnerRows = clearAllSlowLearnerRows;
window.saveAllSlowLearnerRows = saveAllSlowLearnerRows;
window.updateSlDateSubtitle = updateSlDateSubtitle;
window.exportSlowLearnerCSV = exportSlowLearnerCSV;
window.renderModalRows = renderModalRows;
