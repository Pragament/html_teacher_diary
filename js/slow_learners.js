// ================================================================
//  SLOW LEARNER PROGRESS MONITORING MODULE
// ================================================================

const SLOW_LEARNERS_STORAGE_KEY = 'teacherPlanner_slow_learners';

function getTodayDateString() {
    const d = new Date();
    return d.toISOString().split('T')[0];
}

// Generate 5 empty rows for teachers to fill out
function createDefaultEmptyRows(count = 5) {
    const today = getTodayDateString();
    const rows = [];
    for (let i = 0; i < count; i++) {
        rows.push({
            date: today,
            studentName: '',
            subject: '',
            learningGap: '',
            strategyUsed: '',
            progress: '',
            nextStep: ''
        });
    }
    return rows;
}

function loadSlowLearnersData() {
    try {
        const raw = localStorage.getItem(SLOW_LEARNERS_STORAGE_KEY);
        if (!raw) return createDefaultEmptyRows(5);
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : createDefaultEmptyRows(5);
    } catch (e) {
        console.error('Error loading slow learners data:', e);
        return createDefaultEmptyRows(5);
    }
}

function openSlowLearnersModal() {
    const modal = document.getElementById('slow-learners-modal-overlay');
    if (!modal) return;
    
    // Set subtitle date
    const dailyDate = document.getElementById('dailyDate')?.value || getTodayDateString();
    const dateInput = document.getElementById('slowLearnerFilterDate');
    if (dateInput) dateInput.value = dailyDate;
    
    const subtitle = document.getElementById('slowLearnersDateSubtitle');
    if (subtitle) {
        const dateObj = new Date(dailyDate + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        subtitle.textContent = `Date: ${formattedDate} — Progress Monitoring Record`;
    }

    renderSlowLearnersTable();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeSlowLearnersModal() {
    const modal = document.getElementById('slow-learners-modal-overlay');
    if (modal) {
        modal.style.display = 'none';
    }
    document.body.style.overflow = '';
}

function onSlowLearnerDateChange(val) {
    const subtitle = document.getElementById('slowLearnersDateSubtitle');
    if (subtitle && val) {
        const dateObj = new Date(val + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        subtitle.textContent = `Date: ${formattedDate} — Progress Monitoring Record`;
    }
}

function renderSlowLearnersTable() {
    const tbody = document.getElementById('slowLearnersTableBody');
    if (!tbody) return;

    const data = loadSlowLearnersData();
    tbody.innerHTML = '';

    data.forEach((row) => {
        addSlowLearnerRowToDOM(row);
    });
}

function addSlowLearnerRow(rowData = null) {
    const defaultDate = document.getElementById('slowLearnerFilterDate')?.value || getTodayDateString();
    const row = rowData || {
        date: defaultDate,
        studentName: '',
        subject: '',
        learningGap: '',
        strategyUsed: '',
        progress: '',
        nextStep: ''
    };
    addSlowLearnerRowToDOM(row);
}

function addSlowLearnerRowToDOM(row) {
    const tbody = document.getElementById('slowLearnersTableBody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = 'slow-learner-row';
    tr.innerHTML = `
        <td style="padding: 6px 8px;">
            <input type="date" class="sl-input sl-date" value="${escapeHtml(row.date || getTodayDateString())}" />
        </td>
        <td style="padding: 6px 8px;">
            <input type="text" class="sl-input sl-student-name" placeholder="Enter student name..." value="${escapeHtml(row.studentName || '')}" />
        </td>
        <td style="padding: 6px 8px;">
            <input type="text" class="sl-input sl-subject" placeholder="Subject..." value="${escapeHtml(row.subject || '')}" />
        </td>
        <td style="padding: 6px 8px;">
            <textarea class="sl-input sl-learning-gap" placeholder="Describe learning gap..." rows="2">${escapeHtml(row.learningGap || '')}</textarea>
        </td>
        <td style="padding: 6px 8px;">
            <textarea class="sl-input sl-strategy" placeholder="Strategy/Method used..." rows="2">${escapeHtml(row.strategyUsed || '')}</textarea>
        </td>
        <td style="padding: 6px 8px;">
            <select class="sl-input sl-progress">
                <option value="" ${!row.progress ? 'selected' : ''}>-- Select Progress --</option>
                <option value="Improving" ${row.progress === 'Improving' ? 'selected' : ''}>Improving</option>
                <option value="Satisfactory" ${row.progress === 'Satisfactory' ? 'selected' : ''}>Satisfactory</option>
                <option value="Little Improvement" ${row.progress === 'Little Improvement' ? 'selected' : ''}>Little Improvement</option>
                <option value="Needs Focus" ${row.progress === 'Needs Focus' ? 'selected' : ''}>Needs Focus</option>
            </select>
        </td>
        <td style="padding: 6px 8px;">
            <textarea class="sl-input sl-next-step" placeholder="Next step or action plan..." rows="2">${escapeHtml(row.nextStep || '')}</textarea>
        </td>
        <td style="padding: 6px 8px; text-align: center; vertical-align: middle;">
            <button type="button" class="btn-icon text-danger" onclick="deleteSlowLearnerRow(this)" title="Delete Row" style="color: #ef4444; background: transparent; border: none; font-size: 16px; cursor: pointer;">
                🗑️
            </button>
        </td>
    `;
    tbody.appendChild(tr);
}

function deleteSlowLearnerRow(btn) {
    const tr = btn.closest('tr');
    if (tr) tr.remove();
}

function clearAllSlowLearnerRows() {
    if (confirm('Are you sure you want to clear all rows in this table?')) {
        localStorage.removeItem(SLOW_LEARNERS_STORAGE_KEY);
        renderSlowLearnersTable();
        if (typeof showToast === 'function') showToast('Cleared all rows.', 'info');
    }
}

function saveSlowLearnersData() {
    const rows = document.querySelectorAll('.slow-learner-row');
    const updatedData = [];

    rows.forEach(tr => {
        const date = tr.querySelector('.sl-date')?.value || '';
        const studentName = tr.querySelector('.sl-student-name')?.value || '';
        const subject = tr.querySelector('.sl-subject')?.value || '';
        const learningGap = tr.querySelector('.sl-learning-gap')?.value || '';
        const strategyUsed = tr.querySelector('.sl-strategy')?.value || '';
        const progress = tr.querySelector('.sl-progress')?.value || '';
        const nextStep = tr.querySelector('.sl-next-step')?.value || '';

        // Save row if any field is filled out
        if (studentName.trim() !== '' || subject.trim() !== '' || learningGap.trim() !== '' || strategyUsed.trim() !== '' || progress.trim() !== '' || nextStep.trim() !== '') {
            updatedData.push({
                date,
                studentName,
                subject,
                learningGap,
                strategyUsed,
                progress,
                nextStep
            });
        }
    });

    localStorage.setItem(SLOW_LEARNERS_STORAGE_KEY, JSON.stringify(updatedData));
    
    if (typeof showToast === 'function') {
        showToast('✅ Slow Learner Progress Monitoring record saved!', 'success');
    } else {
        alert('Slow Learner Progress Monitoring record saved!');
    }
    
    closeSlowLearnersModal();
}

function exportSlowLearnersCSV() {
    const data = loadSlowLearnersData();
    if (!data || data.length === 0) {
        if (typeof showToast === 'function') showToast('No slow learner records to export', 'info');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Date,Student Name,Subject,Learning Gap,Strategy/Method Used,Progress,Next Step\n";
    
    data.forEach(row => {
        const line = [
            `"${row.date || ''}"`,
            `"${(row.studentName || '').replace(/"/g, '""')}"`,
            `"${(row.subject || '').replace(/"/g, '""')}"`,
            `"${(row.learningGap || '').replace(/"/g, '""')}"`,
            `"${(row.strategyUsed || '').replace(/"/g, '""')}"`,
            `"${(row.progress || '').replace(/"/g, '""')}"`,
            `"${(row.nextStep || '').replace(/"/g, '""')}"`
        ].join(",");
        csvContent += line + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `slow_learner_progress_monitoring_${getTodayDateString()}.csv`);
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
