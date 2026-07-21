async function renderDailyTab() {
    const dateInput = document.getElementById('dailyDate');
    if (!dateInput.value) dateInput.value = getTodayStr();
    const dateStr = dateInput.value;
    const settings = getSettings();
    const periodsPerDay = settings.periodsPerDay || 8;
    const entry = getDayEntry(dateStr);
    const periods = entry ? entry.periods : [];

    const container = document.getElementById('periodCards');
    if (!container) return; // Might be hidden
    container.innerHTML = '<div style="text-align:center; padding: 20px;"><span class="spinner"></span> Loading timetable...</div>';
    
    // Fetch timetable
    if (typeof fetchTodayTimetable === 'function') {
        await fetchTodayTimetable(dateStr);
    }
    const timetableMap = window.currentTimetableMap || {}; 
    container.innerHTML = '';

    for (let i = 1; i <= periodsPerDay; i++) {
        const existing = periods.find(p => p.periodNumber === i) || {
            periodNumber: i, classSection: '', subject: '',
            classwork: '', homework: '', photoUrl: '', files: []
        };
        const timetable = timetableMap[i] || {};
        
        const classSection = existing.classSection || timetable.classSection || '';
        const subject = existing.subject || timetable.subject || '';
        const classwork = existing.classwork || '';
        const homework = existing.homework || '';
        const existingFiles = existing.files || [];
        
        // Initialize file state
        window.periodFiles = window.periodFiles || {};
        window.periodFiles[i] = {
            existing: existingFiles,
            pending: []
        };
        
        // Asynchronously refresh signed URLs
        if (existingFiles.length > 0 && window.FileUploadService) {
            const pathsToRefresh = existingFiles.filter(f => f.path).map(f => f.path);
            if (pathsToRefresh.length > 0) {
                window.FileUploadService.getSignedUrls(pathsToRefresh).then(urlMap => {
                    let updated = false;
                    for (const f of window.periodFiles[i].existing) {
                        if (f.path && urlMap[f.path] && f.url !== urlMap[f.path]) {
                            f.url = urlMap[f.path];
                            updated = true;
                        }
                    }
                    if (updated) {
                        const zone = document.getElementById(`file-zone-${i}`);
                        if (zone) zone.innerHTML = renderFileAttachZone(i);
                        
                        // update local storage silently
                        const entry = getDayEntry(dateStr);
                        if (entry) {
                            const p = entry.periods.find(p => p.periodNumber === i);
                            if (p) {
                                p.files = window.periodFiles[i].existing;
                                saveDayEntry(dateStr, entry.periods);
                            }
                        }
                    }
                }).catch(console.error);
            }
        }
        
        const card = document.createElement('div');
        card.className = 'period-card';
        
        const filesHtml = `
            <div class="file-attach-zone" id="file-zone-${i}">
                ${renderFileAttachZone(i)}
            </div>
        `;
        
        // Ensure dropdown options match the parsed class
        const parsed = parseClassSection(classSection);
        const classDropdownOptions = [
            '<option value="">Class...</option>',
            ...[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}" ${parsed.class === String(n) ? 'selected' : ''}>${n}</option>`)
        ].join('');

        card.innerHTML = `
          <div class="period-card-header">
            <span class="period-badge">Period ${i}</span>
            <div class="period-meta" style="display:flex; gap:8px; align-items:center;">
                <select class="daily-class-dropdown" data-period="${i}" style="width:80px; padding:2px; font-size:12px;">${classDropdownOptions}</select>
                <input type="text" class="daily-section-input" data-period="${i}" value="${escHtml(parsed.section)}" placeholder="Sec" style="width:40px; padding:2px; font-size:12px;" />
                <input type="text" class="daily-subject-input" data-period="${i}" value="${escHtml(subject)}" placeholder="Subject" style="width:80px; padding:2px; font-size:12px;" />
            </div>
          </div>
          <label style="font-size:12px; margin-top:8px;">Classwork</label>
          <textarea class="daily-work" data-period="${i}" rows="2" placeholder="What was taught?">${escHtml(classwork)}</textarea>
          <label style="font-size:12px; margin-top:8px;">Homework</label>
          <textarea class="daily-home" data-period="${i}" rows="2" placeholder="Homework assigned?">${escHtml(homework)}</textarea>
          <div class="period-card-footer">
            <div>${filesHtml}</div>
            <span class="autosave-indicator" id="autosave-${i}"></span>
          </div>
        `;
        container.appendChild(card);
    }
    
    const dailyStatus = document.getElementById('dailyStatus');
    if (dailyStatus) {
        dailyStatus.textContent = entry ? `✅ Loaded entry for ${formatDate(dateStr)}` :
            `📝 No entry yet for ${formatDate(dateStr)}`;
    }

    // Refresh approval status banner and button visibility
    updateApprovalBanner(dateStr);
}

// ================================================================
//  APPROVAL BANNER (teacher view)
// ================================================================
async function updateApprovalBanner(dateStr) {
    const banner = document.getElementById('approvalStatusBanner');
    const icon = document.getElementById('approvalStatusIcon');
    const title = document.getElementById('approvalStatusTitle');
    const subtitle = document.getElementById('approvalStatusSubtitle');
    const revisionBox = document.getElementById('revisionNoteBox');
    const revisionText = document.getElementById('revisionNoteText');
    const submitBtn = document.getElementById('submitForApprovalBtn');
    const saveBtn = document.getElementById('saveDailyBtn');
    const resetBtn = document.getElementById('resetDailyBtn');

    if (!banner) return;

    // Only show for Supabase-authenticated users
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (!client) {
        banner.classList.add('hidden');
        if (submitBtn) submitBtn.style.display = 'none';
        return;
    }

    const dayStatus = await fetchDayStatus(dateStr);

    const periodCards = document.getElementById('periodCards');
    const allInputs = periodCards ? periodCards.querySelectorAll('input, textarea, select') : [];

    if (!dayStatus) {
        // No submitted entry — draft / empty state
        banner.classList.add('hidden');
        if (submitBtn) submitBtn.style.display = 'none';
        allInputs.forEach(el => el.disabled = false);
        if (saveBtn) saveBtn.disabled = false;
        if (resetBtn) resetBtn.disabled = false;
        return;
    }

    banner.classList.remove('hidden');
    revisionBox.classList.add('hidden');

    switch (dayStatus.status) {
        case 'submitted': {
            icon.textContent = '⏳';
            title.textContent = 'Submitted — Awaiting Approval';
            const submittedAt = dayStatus.submittedAt
                ? new Date(dayStatus.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                : '';
            subtitle.textContent = submittedAt ? `Sent for review on ${submittedAt}` : 'Awaiting principal review';
            banner.className = 'approval-status-banner status-submitted';
            // Lock editing
            allInputs.forEach(el => el.disabled = true);
            if (saveBtn) saveBtn.disabled = true;
            if (resetBtn) resetBtn.disabled = true;
            if (submitBtn) submitBtn.style.display = 'none';
            break;
        }
        case 'approved': {
            icon.textContent = '✅';
            title.textContent = 'Approved & Signed';
            const approvedAt = dayStatus.approvedAt
                ? new Date(dayStatus.approvedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                : '';
            subtitle.textContent = approvedAt ? `Signed on ${approvedAt}` : 'Diary locked';
            banner.className = 'approval-status-banner status-approved';
            // Lock editing permanently
            allInputs.forEach(el => el.disabled = true);
            if (saveBtn) saveBtn.disabled = true;
            if (resetBtn) resetBtn.disabled = true;
            if (submitBtn) submitBtn.style.display = 'none';
            break;
        }
        case 'revision_requested': {
            icon.textContent = '🔄';
            title.textContent = 'Revision Requested';
            subtitle.textContent = 'Please review the principal’s note and resubmit.';
            banner.className = 'approval-status-banner status-revision';
            // Show revision note
            if (dayStatus.revisionNote) {
                revisionBox.classList.remove('hidden');
                if (revisionText) revisionText.textContent = dayStatus.revisionNote;
            }
            // Allow editing again
            allInputs.forEach(el => el.disabled = false);
            if (saveBtn) saveBtn.disabled = false;
            if (resetBtn) resetBtn.disabled = false;
            if (submitBtn) submitBtn.style.display = '';
            break;
        }
        default: {
            banner.classList.add('hidden');
            if (submitBtn) submitBtn.style.display = 'none';
            allInputs.forEach(el => el.disabled = false);
        }
    }
}

async function handleSubmitForApproval() {
    const dateStr = document.getElementById('dailyDate').value;
    if (!dateStr) { showToast('Please select a date first.', 'warning'); return; }

    const btn = document.getElementById('submitForApprovalBtn');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Submitting...';

    // Save first to ensure latest data is synced
    await saveDaily();

    const result = await submitDayForApproval(dateStr);

    btn.disabled = false;
    btn.innerHTML = origText;

    if (!result.ok) {
        showToast(`❌ Submit failed: ${result.error}`, 'error');
        return;
    }

    showToast(`📤 Diary submitted for approval! (${result.count} period${result.count !== 1 ? 's' : ''})`, 'success');
    updateApprovalBanner(dateStr);
}

window.updateApprovalBanner = updateApprovalBanner;
window.handleSubmitForApproval = handleSubmitForApproval;

// ================================================================
//  AUTOSAVE
// ================================================================

function setupAutoSave() {
    let autoSaveTimer = null;
    document.addEventListener('input', (e) => {
        if (e.target.matches('.daily-work, .daily-home, .daily-class-dropdown, .daily-section-input, .daily-subject-input, .file-attach-zone')) {
            clearTimeout(autoSaveTimer);
            
            // update individual period indicator if possible
            const period = e.target.dataset.period || e.target.closest('[data-period]')?.dataset.period;
            if (period) {
                const indicator = document.getElementById(`autosave-${period}`);
                if (indicator) indicator.textContent = 'Typing...';
            }
            
            const mainStatus = document.getElementById('autoSaveStatus');
            if (mainStatus) mainStatus.textContent = '⏳ Saving...';
            
            autoSaveTimer = setTimeout(() => {
                // Call saveDaily but suppress the toast
                window.isAutoSaving = true;
                saveDaily();
                window.isAutoSaving = false;
                
                if (period) {
                    const indicator = document.getElementById(`autosave-${period}`);
                    if (indicator) indicator.textContent = '✓ Saved';
                }
                if (mainStatus) mainStatus.textContent = '✓ Saved';
            }, 1500);
        }
    });
}

function renderFileAttachZone(periodNumber) {
    const state = window.periodFiles[periodNumber];
    if (!state) return '';
    
    const allFiles = [...state.existing, ...state.pending];
    
    let html = '<div class="file-list">';
    allFiles.forEach((fileObj, idx) => {
        const isExisting = fileObj.isExisting;
        const icon = window.FileUploadService ? window.FileUploadService.getFileIcon(fileObj.type) : '📎';
        const sizeStr = window.FileUploadService ? window.FileUploadService.formatFileSize(fileObj.size) : '';
        
        html += `
            <div class="file-item">
                <span class="file-item-icon">${icon}</span>
                <span class="file-item-name">
                    ${isExisting && fileObj.url ? `<a href="${fileObj.url}" target="_blank">${escHtml(fileObj.name)}</a>` : escHtml(fileObj.name)}
                </span>
                <span class="file-item-size">${sizeStr}</span>
                <button type="button" class="file-item-remove" onclick="removeFile(${periodNumber}, ${idx}, ${isExisting})" title="Remove file">&times;</button>
            </div>
        `;
    });
    html += '</div>';
    
    if (allFiles.length < (window.FileUploadService?.MAX_FILES_PER_PERIOD || 10)) {
        html += `
            <button type="button" class="file-add-btn" onclick="triggerFileUpload(${periodNumber})">
                📎 Attach Files
            </button>
            <input type="file" id="file-input-${periodNumber}" multiple style="display:none;" onchange="handleFilesSelect(event, ${periodNumber})" />
        `;
    }
    
    return html;
}

function triggerFileUpload(periodNumber) {
    document.getElementById(`file-input-${periodNumber}`).click();
}

function handleFilesSelect(event, periodNumber) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const state = window.periodFiles[periodNumber];
    const allFiles = [...state.existing, ...state.pending];
    
    let addedCount = 0;
    
    for (const file of files) {
        if (window.FileUploadService) {
            const validation = window.FileUploadService.validateFileForPeriod(file, allFiles);
            if (!validation.valid) {
                showToast(validation.error, 'error');
                continue;
            }
        }
        
        state.pending.push(file);
        allFiles.push(file);
        addedCount++;
    }
    
    if (addedCount > 0) {
        document.getElementById(`file-zone-${periodNumber}`).innerHTML = renderFileAttachZone(periodNumber);
        
        // Trigger autosave if needed
        const e = new Event('input', { bubbles: true });
        document.getElementById(`file-zone-${periodNumber}`).dispatchEvent(e);
    }
    
    // Reset input
    event.target.value = '';
}

async function removeFile(periodNumber, index, isExisting) {
    const state = window.periodFiles[periodNumber];
    
    if (isExisting) {
        if (!confirm('Are you sure you want to delete this file? This cannot be undone.')) return;
        const fileObj = state.existing[index];
        
        // Optimistically remove from UI
        state.existing.splice(index, 1);
        document.getElementById(`file-zone-${periodNumber}`).innerHTML = renderFileAttachZone(periodNumber);
        
        try {
            if (window.FileUploadService && fileObj.id) {
                await window.FileUploadService.deleteAttachment(fileObj.id, fileObj.path);
                showToast('File deleted successfully', 'success');
            }
        } catch (err) {
            // Revert on failure
            state.existing.splice(index, 0, fileObj);
            document.getElementById(`file-zone-${periodNumber}`).innerHTML = renderFileAttachZone(periodNumber);
            showToast('Failed to delete file: ' + err.message, 'error');
        }
    } else {
        // Just remove from pending array
        const pendingIndex = index - state.existing.length;
        if (pendingIndex >= 0 && pendingIndex < state.pending.length) {
            state.pending.splice(pendingIndex, 1);
            document.getElementById(`file-zone-${periodNumber}`).innerHTML = renderFileAttachZone(periodNumber);
        }
    }
}

async function saveDaily() {
    const dateStr = document.getElementById('dailyDate').value;
    if (!dateStr) { 
        if (!window.isAutoSaving) showToast('Please select a date.', 'warning'); 
        return; 
    }
    const cards = document.querySelectorAll('.period-card');
    const periods = [];
    let hasData = false;

    const saveBtn = document.getElementById('saveDailyBtn');
    const stickySaveBtn = document.getElementById('stickySaveBtn');
    
    let originalBtnHtml = '';
    if (!window.isAutoSaving) {
        if (saveBtn) {
            originalBtnHtml = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
        }
        if (stickySaveBtn) {
            stickySaveBtn.disabled = true;
            stickySaveBtn.textContent = 'Saving...';
        }
    }

    try {
        for (const card of cards) {
            const classDropdown = card.querySelector('.daily-class-dropdown');
            const periodNum = parseInt(classDropdown?.dataset.period || '0');
            const classDropdownVal = classDropdown?.value || '';
            const sectionVal = card.querySelector('.daily-section-input')?.value?.trim() || '';
            const classVal = (classDropdownVal && sectionVal) ? `${classDropdownVal}-${sectionVal}` : (classDropdownVal || sectionVal);
            const subjectVal = card.querySelector('.daily-subject-input')?.value?.trim() || '';
            const workVal = card.querySelector('.daily-work')?.value?.trim() || '';
            const homeVal = card.querySelector('.daily-home')?.value?.trim() || '';
            const state = window.periodFiles ? window.periodFiles[periodNum] : { existing: [], pending: [] };

            periods.push({
                periodNumber: periodNum,
                classSection: classVal,
                subject: subjectVal,
                classwork: workVal,
                homework: homeVal,
                files: state.existing,
                pendingFiles: state.pending
            });

            if (classVal || subjectVal || workVal || homeVal || state.existing.length > 0 || state.pending.length > 0) hasData = true;
        }

        if (!hasData && !window.isAutoSaving) {
            if (!confirm("All fields are empty. Do you want to clear this day's entry?")) {
                if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = originalBtnHtml; }
                if (stickySaveBtn) { stickySaveBtn.disabled = false; stickySaveBtn.textContent = '✓ Save All'; }
                return;
            }
        }

        if (typeof saveEntryToSupabase === 'function') {
            const result = await saveEntryToSupabase(dateStr, periods);
            if (!result.ok && !window.isAutoSaving) {
                showToast(`⚠️ Sync failed. Saved offline.`, 'warning');
            } else if (result.ok && !window.isAutoSaving) {
                showToast(`✅ Saved activities for ${formatDate(dateStr)}`, 'success');
                renderDailyTab();
            }
        } else {
            saveDayEntry(dateStr, periods);
            if (!window.isAutoSaving) {
                showToast(`✅ Saved activities for ${formatDate(dateStr)}`, 'success');
                renderDailyTab();
            }
        }
        
        if (typeof updateBadge === 'function') updateBadge();
        if (document.getElementById('tab-view')?.classList.contains('active')) renderViewTab();
    } catch (err) {
        if (!window.isAutoSaving) showToast(`❌ Error saving: ${err.message}`, 'error');
    } finally {
        if (!window.isAutoSaving) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = originalBtnHtml; }
            if (stickySaveBtn) { stickySaveBtn.disabled = false; stickySaveBtn.textContent = '✓ Save All'; }
        }
    }
}