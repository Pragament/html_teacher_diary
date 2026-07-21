// ================================================================
//  PHASE 4: REVISION HISTORY (Google Docs Style)
// ================================================================

let _historyModalData = null; // Store current viewed context

/**
 * Opens the history modal and renders the timeline for a given teacher's daily entry.
 */
async function openHistoryModal(dateStr, overrideTeacherId = null) {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (!client) {
        showToast('Database connection unavailable.', 'error');
        return;
    }

    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    
    // Determine the teacher ID (if Principal reviewing, we pass it, otherwise current user)
    const targetTeacherId = overrideTeacherId || session.user.id;
    
    // Determine if the current user is a principal
    const role = localStorage.getItem('userRole') || 'teacher';
    const isPrincipal = ['principal', 'vice_principal', 'admin', 'super_admin'].includes(role);
    
    _historyModalData = { dateStr, targetTeacherId, isPrincipal };
    
    const overlay = document.getElementById('history-modal-overlay');
    if (overlay) overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // lock background scrolling
    
    const container = document.getElementById('history-timeline-container');
    if (container) {
        container.innerHTML = '<div style="text-align:center; padding:40px;"><span class="spinner"></span> Loading history...</div>';
    }
    
    await loadHistoryTimeline(targetTeacherId, dateStr, isPrincipal);
}

function closeHistoryModal() {
    const overlay = document.getElementById('history-modal-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
    _historyModalData = null;
}

/**
 * Loads the revisions and audit logs and builds the timeline UI.
 */
async function loadHistoryTimeline(teacherId, dateStr, isPrincipal) {
    const client = getSupabaseClient();
    if (!client) return;

    try {
        // 1. Fetch all daily_entries for this teacher+date, order by period and revision
        const { data: entries, error: entriesErr } = await client
            .from('daily_entries')
            .select(`
                id, date, period_number, class_section, subject, classwork, homework,
                status, revision_number, created_at, submitted_at, approved_at
            `)
            .eq('teacher_id', teacherId)
            .eq('date', dateStr)
            .order('period_number', { ascending: true })
            .order('revision_number', { ascending: true });

        if (entriesErr) throw entriesErr;
        
        // 2. Fetch all audit_logs matching these entries if possible
        // Actually, for Principal View, we want full audit. For teachers, we want basic action timeline.
        // Easiest is to fetch audit logs for this specific date and teacher_id.
        let auditLogs = [];
        const { data: audits, error: auditErr } = await client
            .from('audit_logs')
            .select('id, user_id, role, action, table_name, record_id, before_value, after_value, ip_address, user_agent, created_at, users:user_id(name, email)')
            .eq('table_name', 'daily_entries')
            .order('created_at', { ascending: true });
            
        if (!auditErr && audits) {
            // Filter locally to match the entry IDs or date (since JSON querying in Supabase REST can be tricky)
            const entryIds = new Set(entries.map(e => e.id));
            auditLogs = audits.filter(a => {
                // If the record_id matches one of our entries directly
                if (entryIds.has(a.record_id)) return true;
                
                // If it was a batch action (e.g. SUBMIT_FOR_APPROVAL where record_id is comma-separated)
                if (a.record_id && a.record_id.includes(',')) {
                    const ids = a.record_id.split(',');
                    return ids.some(id => entryIds.has(id));
                }
                
                return false;
            });
        }
        
        renderTimelineUI(entries, auditLogs, isPrincipal);
        
    } catch (e) {
        console.error("Failed to load history timeline:", e);
        const container = document.getElementById('history-timeline-container');
        if (container) {
            container.innerHTML = `<div class="empty-state"><span class="emoji">⚠️</span><p>Error loading history: ${escHtml(e.message)}</p></div>`;
        }
    }
}

/**
 * Diffing engine: Compares v1 and v2, returns array of changes.
 */
function diffEntries(v1, v2) {
    const changes = [];
    const fields = ['class_section', 'subject', 'classwork', 'homework'];
    const fieldNames = {
        'class_section': 'Class & Section',
        'subject': 'Subject',
        'classwork': 'Classwork',
        'homework': 'Homework'
    };
    
    if (!v1) {
        // Everything is an addition
        fields.forEach(f => {
            if (v2[f] && v2[f].trim() !== '') {
                changes.push({ field: fieldNames[f], action: 'added', new: v2[f] });
            }
        });
        return changes;
    }
    
    fields.forEach(f => {
        const oldVal = (v1[f] || '').trim();
        const newVal = (v2[f] || '').trim();
        if (oldVal !== newVal) {
            if (oldVal === '') {
                changes.push({ field: fieldNames[f], action: 'added', new: newVal });
            } else if (newVal === '') {
                changes.push({ field: fieldNames[f], action: 'removed', old: oldVal });
            } else {
                changes.push({ field: fieldNames[f], action: 'changed', old: oldVal, new: newVal });
            }
        }
    });
    
    return changes;
}

/**
 * Builds and injects the HTML for the timeline.
 */
function renderTimelineUI(entries, auditLogs, isPrincipal) {
    const container = document.getElementById('history-timeline-container');
    if (!container) return;

    if (!entries || entries.length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="emoji">📭</span><p>No history available for this date.</p></div>`;
        return;
    }

    // Group entries by period
    const periods = {};
    entries.forEach(e => {
        if (!periods[e.period_number]) periods[e.period_number] = [];
        periods[e.period_number].push(e);
    });

    let html = '';
    
    // 1. TIMELINE VIEW
    html += '<div class="history-view-section">';
    html += '<h3>Revision Timeline</h3>';
    
    // Iterate through periods
    Object.keys(periods).sort((a,b) => parseInt(a) - parseInt(b)).forEach(pNum => {
        const pEntries = periods[pNum];
        html += `<div class="history-period-group"><h4>Period ${pNum}</h4>`;
        html += `<div class="version-timeline">`;
        
        for (let i = 0; i < pEntries.length; i++) {
            const entry = pEntries[i];
            const prevEntry = i > 0 ? pEntries[i-1] : null;
            
            // Find creation audit log for this revision if it exists
            const createLog = auditLogs.find(a => a.record_id === entry.id && a.action === 'CREATE_REVISION');
            const authorName = createLog && createLog.users ? (createLog.users.name || createLog.users.email) : 'Teacher';
            
            // Diff against previous
            const changes = diffEntries(prevEntry, entry);
            
            // Render step
            const isLatest = i === pEntries.length - 1;
            const timeStr = new Date(entry.created_at).toLocaleString('en-IN', { timeStyle: 'short', dateStyle: 'medium' });
            
            html += `
                <div class="version-step ${isLatest ? 'current' : ''}">
                    <div class="step-dot"></div>
                    <div class="step-content">
                        <div class="step-header">
                            <span class="step-title">Version ${entry.revision_number}</span>
                            <span class="step-meta">• ${timeStr} • 👤 ${escHtml(authorName)}</span>
                        </div>
                        <div class="step-details">
            `;
            
            if (i === 0) {
                html += `<div class="diff-chip added">✨ Created entry</div>`;
                html += `<div class="diff-block">`;
                changes.forEach(c => {
                    html += `<div class="diff-row"><span class="diff-field">${c.field}:</span> <span class="diff-new-val">${escHtml(c.new)}</span></div>`;
                });
                html += `</div>`;
            } else if (changes.length === 0) {
                html += `<div class="diff-chip neutral">💤 Saved without changes</div>`;
            } else {
                html += `<div class="diff-chip edited">📝 Edited</div>`;
                changes.forEach(c => {
                    html += `<div class="diff-block-row">
                                <div class="diff-field-title">${c.field}</div>
                             `;
                    if (c.action === 'added') {
                        html += `<div class="diff-compare">
                                    <div class="diff-after"><span class="diff-label after-label">Added</span> ${escHtml(c.new)}</div>
                                 </div>`;
                    } else if (c.action === 'removed') {
                        html += `<div class="diff-compare">
                                    <div class="diff-before"><span class="diff-label before-label">Removed</span> ${escHtml(c.old)}</div>
                                 </div>`;
                    } else {
                        html += `<div class="diff-compare">
                                    <div class="diff-before"><span class="diff-label before-label">Before</span> ${escHtml(c.old)}</div>
                                    <div class="diff-after"><span class="diff-label after-label">After</span> ${escHtml(c.new)}</div>
                                 </div>`;
                    }
                    html += `</div>`;
                });
            }
            
            html += `</div></div></div>`;
        }
        html += `</div></div>`;
    });
    html += '</div>'; // end timeline section
    
    // 2. AUDIT LOG (PRINCIPAL ONLY)
    if (isPrincipal) {
        html += '<hr style="margin:30px 0; border:none; border-top:1px solid #e2e8f0;">';
        html += '<div class="history-view-section">';
        html += '<h3>Full Audit Log</h3>';
        html += `<div class="audit-table-wrapper"><table class="audit-log-table">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>IP Address</th>
                    <th>Device</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        if (auditLogs.length === 0) {
            html += `<tr><td colspan="5" style="text-align:center; padding:20px; color:#64748b;">No audit logs available for this date.</td></tr>`;
        } else {
            auditLogs.forEach(log => {
                const timeStr = new Date(log.created_at).toLocaleString('en-IN', { timeStyle: 'short', dateStyle: 'medium' });
                const userName = log.users ? (log.users.name || log.users.email) : 'Unknown';
                
                let actionClass = '';
                if (log.action === 'CREATE_REVISION') actionClass = 'create';
                else if (log.action === 'APPROVE_ENTRIES') actionClass = 'approve';
                else if (log.action === 'SUBMIT_FOR_APPROVAL') actionClass = 'submit';
                else if (log.action === 'REQUEST_REVISION') actionClass = 'revise';
                
                let actionFmt = `<span class="audit-action ${actionClass}">${escHtml(log.action)}</span>`;
                
                let browserStr = 'Unknown';
                if (log.user_agent) {
                    if (log.user_agent.includes('Chrome')) browserStr = 'Chrome';
                    else if (log.user_agent.includes('Safari') && !log.user_agent.includes('Chrome')) browserStr = 'Safari';
                    else if (log.user_agent.includes('Firefox')) browserStr = 'Firefox';
                    else if (log.user_agent.includes('Edg')) browserStr = 'Edge';
                    
                    if (log.user_agent.includes('Mobile') || log.user_agent.includes('Android') || log.user_agent.includes('iPhone')) {
                        browserStr += ' (Mobile)';
                    } else {
                        browserStr += ' (Desktop)';
                    }
                }
                
                html += `
                    <tr>
                        <td style="white-space:nowrap;">${timeStr}</td>
                        <td>${escHtml(userName)} <span class="badge-role">${escHtml(log.role)}</span></td>
                        <td>${actionFmt}</td>
                        <td><code>${escHtml(log.ip_address || '—')}</code></td>
                        <td style="font-size:11px;" title="${escHtml(log.user_agent || '')}">${browserStr}</td>
                    </tr>
                `;
            });
        }
        
        html += `</tbody></table></div></div>`;
    }

    container.innerHTML = html;
}
