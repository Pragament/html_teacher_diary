// ================================================================
//  UI: SETTINGS TAB
// ================================================================
async function loadSettingsUI() {
    const settings = getSettings();
    document.getElementById('settingsPeriods').value = settings.periodsPerDay || 8;
    
    const subjectSelect = document.getElementById('settingsTeacherSubject');
    const boardSelect = document.getElementById('settingsCurriculumBoard');
    const classSelect = document.getElementById('settingsCurriculumClass');
    const curriculumSubjectSelect = document.getElementById('settingsCurriculumSubject');
    const fileTypeSelect = document.getElementById('settingsCurriculumFileType');

    try {
        let [boards, classes, subjects] = await Promise.all([
            window.apiFetchBoards().catch(() => []),
            window.apiFetchClasses().catch(() => []),
            window.apiFetchSubjects().catch(() => [])
        ]);

        if (!boards || boards.length === 0) {
            boards = [{ id: 1, name: 'CBSE' }, { id: 2, name: 'ICSE' }, { id: 3, name: 'State Board' }];
        }
        if (!classes || classes.length === 0) {
            classes = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: String(i + 1) }));
        }
        if (!subjects || subjects.length === 0) {
            subjects = [
                { id: 1, name: 'Mathematics' },
                { id: 2, name: 'Science' },
                { id: 3, name: 'Social Studies' },
                { id: 4, name: 'English' },
                { id: 5, name: 'Hindi' },
                { id: 6, name: 'Telugu' }
            ];
        }

        if (boardSelect) {
            boardSelect.innerHTML = boards.map(b => `<option value="${escHtml(b.name)}">${escHtml(b.name)}</option>`).join('');
            boardSelect.value = settings.curriculumBoard || 'CBSE';
        }

        if (classSelect) {
            classSelect.innerHTML = classes.map(c => `<option value="${escHtml(c.name)}">${escHtml(c.name)}</option>`).join('');
            classSelect.value = settings.curriculumClass || '10';
        }

        if (curriculumSubjectSelect) {
            curriculumSubjectSelect.innerHTML = subjects.map(s => `<option value="${escHtml(s.name)}">${escHtml(s.name)}</option>`).join('');
            curriculumSubjectSelect.value = settings.curriculumSubject || 'Mathematics';
        }

        if (subjectSelect) {
            subjectSelect.innerHTML = [
                '<option value="">All Subjects (No Restriction)</option>',
                ...subjects.map(s => `<option value="${escHtml(s.name)}">${escHtml(s.name)}</option>`)
            ].join('\n');
            subjectSelect.value = localStorage.getItem('userSubject') || '';
        }
    } catch (err) {
        console.error('Error populating dynamic dropdown options:', err);
    }

    if (fileTypeSelect) fileTypeSelect.value = settings.curriculumFileType || 'topics';
}

function savePeriodsSetting() {
    const val = parseInt(document.getElementById('settingsPeriods').value);
    if (val < 1 || val > 20) { showToast('Please enter a number between 1 and 20.', 'warning'); return; }
    const settings = getSettings();
    settings.periodsPerDay = val;
    saveSettings(settings);
    showToast(`✅ Periods per day set to ${val}`, 'success');
    if (document.getElementById('tab-daily').classList.contains('active')) renderDailyTab();
}

function saveCurriculumConfigSetting() {
    const board = document.getElementById('settingsCurriculumBoard').value;
    const className = document.getElementById('settingsCurriculumClass').value;
    const subject = document.getElementById('settingsCurriculumSubject').value;
    const fileType = document.getElementById('settingsCurriculumFileType').value;
    
    const settings = getSettings();
    settings.curriculumBoard = board;
    settings.curriculumClass = className;
    settings.curriculumSubject = subject;
    settings.curriculumFileType = fileType;
    saveSettings(settings);
    
    showToast('✅ Dynamic content configuration saved.', 'success');
    loadCurriculumCSV(true);
}

async function saveSubjectSetting() {
    const select = document.getElementById('settingsTeacherSubject');
    if (!select) return;
    const newSubject = select.value;
    
    // Save to localStorage immediately
    if (newSubject) {
        localStorage.setItem('userSubject', newSubject);
    } else {
        localStorage.removeItem('userSubject');
    }
    
    // If Supabase is authenticated, update the user metadata in the cloud
    if (isSupabaseConfigValid()) {
        const client = getSupabaseClient();
        if (client) {
            try {
                const { data: { session } } = await client.auth.getSession();
                if (session && session.user) {
                    const saveBtn = document.getElementById('settingsSaveSubject');
                    const origText = saveBtn.textContent;
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Saving...';
                    
                    const { error } = await client.auth.updateUser({
                        data: { subject: newSubject }
                    });
                    
                    saveBtn.disabled = false;
                    saveBtn.textContent = origText;
                    
                    if (error) {
                        showToast(`Failed to sync subject to Supabase: ${error.message}`, 'error');
                        return;
                    }
                    
                    // Trigger session re-read to update UI displays
                    const { data: { session: updatedSession } } = await client.auth.getSession();
                    if (updatedSession) {
                        handleAuthState(updatedSession);
                    }
                }
            } catch (e) {
                console.warn('Could not sync subject with Supabase:', e);
            }
        }
    }
    
    showToast(newSubject ? `✅ Subject configured to ${newSubject}` : '✅ Subject filtering disabled.', 'success');
}

function clearAllData() {
    if (!confirm('⚠️ Are you sure you want to delete ALL local activities? This cannot be undone!')) return;
    if (!confirm('⚠️ Final confirmation: delete all data?')) return;
    saveActivities([]);
    updateBadge();
    renderDailyTab();
    if (document.getElementById('tab-view').classList.contains('active')) renderViewTab();
    showToast('🗑 All data cleared.', 'warning');
}

// ================================================================
//  UI: BADGE
// ================================================================
function updateBadge() {
    const activities = getActivities();
    const total = activities.reduce((sum, d) => sum + d.periods.filter(p => p.classSection || p.subjectTopics || p.classwork || p.homework || p.photoUrl)
        .length, 0);
    document.getElementById('viewBadge').textContent = total;
}

// ================================================================
//  UI: LIGHTBOX
// ================================================================
function openLightbox(url) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = url;
    lightbox.classList.add('active');
