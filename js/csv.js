// ================================================================
//  CSV EXPORT / IMPORT
// ================================================================
function exportCSV() {
    const activities = getActivities();
    const rows = [];
    for (const day of activities) {
        for (const p of day.periods) {
            rows.push([
                day.date,
                p.periodNumber,
                p.classSection || '',
                p.classwork || '',
                p.homework || '',
                p.photoUrl || ''
            ]);
        }
    }
    if (rows.length === 0) {
        showToast('No data to export.', 'warning');
        return;
    }
    const header = ['date', 'period_number', 'class_section', 'classwork', 'homework', 'photo_url'];
    const csvContent = [header.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'activities.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Exported entries.', 'success');
}

function importCSV(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const text = e.target.result;
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) { showToast('CSV must have a header row and at least one data row.', 'error'); return; }
            const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
            const dateIdx = header.indexOf('date');
            const periodIdx = header.indexOf('period_number');
            const classIdx = header.indexOf('class_section');
            const workIdx = header.indexOf('classwork');
            const homeIdx = header.indexOf('homework');
            const photoIdx = header.indexOf('photo_url');
            if (dateIdx < 0 || periodIdx < 0) { showToast('CSV must have "date" and "period_number" columns.', 'error'); return; }
            const grouped = {};
            for (let i = 1; i < lines.length; i++) {
                const cols = parseCSVLine(lines[i]);
                if (cols.length < 2) continue;
                const date = cols[dateIdx]?.trim() || '';
                const period = parseInt(cols[periodIdx]?.trim()) || 0;
                if (!date || !period) continue;
                if (!grouped[date]) grouped[date] = [];
                grouped[date].push({ periodNumber: period, classSection: classIdx >= 0 ? (cols[classIdx]?.trim() || '') : '', subjectTopics: '', classwork: workIdx >= 0 ? (cols[workIdx]?.trim() || '') : '', homework: homeIdx >= 0 ? (cols[homeIdx]?.trim() || '') : '', photoUrl: photoIdx >= 0 ? (cols[photoIdx]?.trim() || '') : '' });
            }
            const activities = Object.keys(grouped).map(date => ({ id: generateId(), date: date, periods: grouped[date].sort((a, b) => a.periodNumber - b.periodNumber) }));
            if (activities.length === 0) { showToast('No valid data found in CSV.', 'warning'); return; }
            const existing = getActivities();
            const newActivities = [...existing];
            for (const act of activities) { const idx = newActivities.findIndex(a => a.date === act.date); if (idx >= 0) newActivities[idx] = act; else newActivities.push(act); }
            saveActivities(newActivities);
            showToast('Imported days from CSV.', 'success');
            renderViewTab();
            updateBadge();
        } catch (err) { showToast('Error parsing CSV: ' + err.message, 'error'); }
    };
    reader.readAsText(file, 'UTF-8');
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && (i + 1 < line.length && line[i + 1] === '"')) { current += '"'; i++; }
            else if (ch === '"') { inQuotes = false; }
            else { current += ch; }
        } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { result.push(current.trim()); current = ''; }
            else { current += ch; }
        }
    }
    result.push(current.trim());
    return result;
}

// ================================================================
//  STUDENT DATA MOCK
// ================================================================
window.studentsDB = [];
window.studentsDBReady = false;

async function loadTestStudents() {
    try {
        const response = await fetch('data/test_students.csv');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) return;
        
        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        const idIdx = header.indexOf('student_id');
        const nameIdx = header.indexOf('student_name');
        const classIdx = header.indexOf('class');
        const secIdx = header.indexOf('section');
        const rollIdx = header.indexOf('roll_no');
        
        const db = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (cols.length < 2) continue;
            db.push({
                id: cols[idIdx] || '',
                name: cols[nameIdx] || '',
                class: cols[classIdx] || '',
                section: cols[secIdx] || '',
                rollNo: cols[rollIdx] || ''
            });
        }
        window.studentsDB = db;
        window.studentsDBReady = true;
        console.log(`Loaded ${db.length} students dynamically from CSV.`);
        return db;
    } catch (e) {
        console.error('Failed to load test_students.csv:', e);
        window.studentsDB = [];
        window.studentsDBReady = false;
        throw e;
    }
}
window.loadTestStudents = loadTestStudents;
