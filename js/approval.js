// ================================================================
//  PHASE 3: APPROVAL WORKFLOW SERVICE
// ================================================================

/**
 * Submits all period entries for a given date for principal approval.
 * Sets status = 'submitted' and records submitted_at timestamp.
 * Only affects entries currently in 'draft' or 'revision_requested' status.
 */
async function submitDayForApproval(dateStr) {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Not connected to Supabase.' };

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return { ok: false, error: 'Not signed in.' };

        // Fetch the latest revision entries for this teacher+date
        const { data: entries, error: fetchErr } = await client
            .from('daily_entries')
            .select('id, status, period_number, revision_number')
            .eq('teacher_id', session.user.id)
            .eq('date', dateStr)
            .in('status', ['draft', 'revision_requested'])
            .order('revision_number', { ascending: false });

        if (fetchErr) return { ok: false, error: fetchErr.message };
        if (!entries || entries.length === 0) {
            return { ok: false, error: 'No saveable entries found for this date. Please save first.' };
        }

        // Deduplicate: keep only the latest revision per period_number
        const latestByPeriod = {};
        for (const e of entries) {
            if (!latestByPeriod[e.period_number] || e.revision_number > latestByPeriod[e.period_number].revision_number) {
                latestByPeriod[e.period_number] = e;
            }
        }
        const ids = Object.values(latestByPeriod).map(e => e.id);

        const { error: updateErr } = await client
            .from('daily_entries')
            .update({
                status: 'submitted',
                submitted_at: new Date().toISOString(),
                revision_note: null
            })
            .in('id', ids);

        if (updateErr) return { ok: false, error: updateErr.message };

        await writeAuditLog(client, session.user.id, 'teacher', 'SUBMIT_FOR_APPROVAL', 'daily_entries', ids.join(','), null, { date: dateStr, count: ids.length });

        // Phase 6: Notification
        if (window.sendNotificationToAllPrincipals) {
            const teacherName = session.user.user_metadata?.full_name || session.user.email || 'A teacher';
            await window.sendNotificationToAllPrincipals(
                'submission',
                `📋 New Diary Submitted`,
                `${teacherName} submitted their diary for ${dateStr}.`,
                dateStr,
                ids
            );
        }

        return { ok: true, count: ids.length, entryIds: ids };
    } catch (e) {
        console.error('submitDayForApproval error:', e);
        return { ok: false, error: e.message };
    }
}

/**
 * Fetches the submission status for a specific teacher+date.
 * Returns the status of the latest revisions.
 */
async function fetchDayStatus(dateStr) {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return null;

        const { data: entries } = await client
            .from('daily_entries')
            .select('id, status, revision_number, submitted_at, approved_at, revision_note')
            .eq('teacher_id', session.user.id)
            .eq('date', dateStr)
            .order('revision_number', { ascending: false });

        if (!entries || entries.length === 0) return null;

        // Deduplicate: latest revision per period
        const latestByPeriod = {};
        for (const e of entries) {
            if (!latestByPeriod[e.period_number] || e.revision_number > latestByPeriod[e.period_number].revision_number) {
                latestByPeriod[e.period_number] = e;
            }
        }
        const latest = Object.values(latestByPeriod);

        // The overall day status is the "worst" status (draft < revision_requested < submitted < approved)
        const statusPriority = { draft: 0, revision_requested: 1, submitted: 2, approved: 3 };
        latest.sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);

        const dominantEntry = latest[0]; // lowest priority = most-needs-action status
        return {
            status: dominantEntry.status,
            submittedAt: dominantEntry.submitted_at,
            approvedAt: dominantEntry.approved_at,
            revisionNote: dominantEntry.revision_note,
            entryIds: latest.map(e => e.id)
        };
    } catch (e) {
        console.error('fetchDayStatus error:', e);
        return null;
    }
}

/**
 * Fetches the principal signature for a given day's entry IDs.
 */
async function fetchSignatureForDay(entryIds) {
    const client = getSupabaseClient();
    if (!client || !entryIds || entryIds.length === 0) return null;
    try {
        const { data } = await client
            .from('principal_signatures')
            .select('id, signed_by, remarks, signed_at, users!signed_by(name, email)')
            .in('entry_id', entryIds)
            .order('signed_at', { ascending: false })
            .limit(1);
        return data && data.length > 0 ? data[0] : null;
    } catch (e) {
        console.error('fetchSignatureForDay error:', e);
        return null;
    }
}

// ================================================================
//  PRINCIPAL-SIDE FUNCTIONS
// ================================================================

/**
 * Fetches all pending submissions for the principal dashboard.
 * Groups by teacher + date.
 */
async function fetchPendingSubmissions() {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Not connected.' };

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return { ok: false, error: 'Not signed in.' };

        const { data, error } = await client
            .from('daily_entries')
            .select(`
                id, date, period_number, class_section, subject, classwork, homework,
                status, revision_number, submitted_at, revision_note,
                teacher:users(id, name, email, avatar_url)
            `)
            .eq('status', 'submitted')
            .order('submitted_at', { ascending: true });

        if (error) return { ok: false, error: error.message };

        // Group by teacher_id + date
        const groups = {};
        for (const entry of (data || [])) {
            const tId = entry.teacher ? entry.teacher.id : 'unknown';
            const key = `${tId}__${entry.date}`;
            if (!groups[key]) {
                groups[key] = {
                    teacherId: tId,
                    teacherName: entry.teacher ? (entry.teacher.name || entry.teacher.email) : 'Unknown Teacher',
                    teacherEmail: entry.teacher ? entry.teacher.email : '',
                    teacherAvatar: entry.teacher ? entry.teacher.avatar_url : '',
                    date: entry.date,
                    submittedAt: entry.submitted_at,
                    entries: []
                };
            }
            groups[key].entries.push(entry);
        }

        return { ok: true, data: Object.values(groups) };
    } catch (e) {
        console.error('fetchPendingSubmissions error:', e);
        return { ok: false, error: e.message };
    }
}

/**
 * Fetches approved/history entries for the principal dashboard.
 */
async function fetchApprovedHistory(limit = 50) {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Not connected.' };

    try {
        const { data, error } = await client
            .from('daily_entries')
            .select(`
                id, date, period_number, class_section, subject, classwork, homework,
                status, revision_number, submitted_at, approved_at, revision_note,
                teacher:users(id, name, email, avatar_url)
            `)
            .in('status', ['approved', 'revision_requested'])
            .order('updated_at', { ascending: false });

        if (error) return { ok: false, error: error.message };

        const groups = {};
        for (const entry of (data || [])) {
            const tId = entry.teacher ? entry.teacher.id : 'unknown';
            const key = `${tId}__${entry.date}`;
            if (!groups[key]) {
                groups[key] = {
                    teacherId: tId,
                    teacherName: entry.teacher ? (entry.teacher.name || entry.teacher.email) : 'Unknown Teacher',
                    teacherEmail: entry.teacher ? entry.teacher.email : '',
                    teacherAvatar: entry.teacher ? entry.teacher.avatar_url : '',
                    date: entry.date,
                    status: entry.status, // might be mixed if partial, but typically whole day is approved
                    approvedAt: entry.approved_at,
                    entries: []
                };
            }
            groups[key].entries.push(entry);
        }

        return { ok: true, data: Object.values(groups) };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

/**
 * Generates a SHA-256 signature hash for the approval record.
 */
async function generateSignatureHash(principalId, entryIds, timestamp) {
    const message = `${principalId}|${entryIds.sort().join(',')}|${timestamp}`;
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Approves a day's submission: sets status = 'approved', inserts signature.
 */
async function approveDayEntry(entryIds, remarks = '') {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Not connected.' };

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return { ok: false, error: 'Not signed in.' };

        const timestamp = new Date().toISOString();
        const signatureHash = await generateSignatureHash(session.user.id, entryIds, timestamp);

        // Update all entries to 'approved'
        const { error: updateErr } = await client
            .from('daily_entries')
            .update({
                status: 'approved',
                approved_at: timestamp
            })
            .in('id', entryIds);

        if (updateErr) return { ok: false, error: updateErr.message };

        // Insert one signature record per entry
        const sigRecords = entryIds.map(id => ({
            entry_id: id,
            signed_by: session.user.id,
            signature_hash: signatureHash,
            remarks: remarks || null,
            signed_at: timestamp
        }));

        const { error: sigErr } = await client
            .from('principal_signatures')
            .insert(sigRecords);

        if (sigErr) console.warn('Signature insert warning:', sigErr.message);

        await writeAuditLog(client, session.user.id, 'principal', 'APPROVE_ENTRIES', 'daily_entries', entryIds.join(','), null, { approved_at: timestamp, remarks });

        return { ok: true, signatureHash };
    } catch (e) {
        console.error('approveDayEntry error:', e);
        return { ok: false, error: e.message };
    }
}

/**
 * Requests revision on a submission: sets status = 'revision_requested'.
 */
async function requestRevision(entryIds, revisionNote) {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Not connected.' };

    if (!revisionNote || !revisionNote.trim()) {
        return { ok: false, error: 'A revision note is required.' };
    }

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return { ok: false, error: 'Not signed in.' };

        const { error } = await client
            .from('daily_entries')
            .update({
                status: 'revision_requested',
                revision_note: revisionNote.trim(),
                submitted_at: null
            })
            .in('id', entryIds);

        if (error) return { ok: false, error: error.message };

        await writeAuditLog(client, session.user.id, 'principal', 'REQUEST_REVISION', 'daily_entries', entryIds.join(','), null, { note: revisionNote });

        return { ok: true };
    } catch (e) {
        console.error('requestRevision error:', e);
        return { ok: false, error: e.message };
    }
}

// Expose globally
window.submitDayForApproval = submitDayForApproval;
window.fetchDayStatus = fetchDayStatus;
window.fetchSignatureForDay = fetchSignatureForDay;
window.fetchPendingSubmissions = fetchPendingSubmissions;
window.fetchApprovedHistory = fetchApprovedHistory;
window.approveDayEntry = approveDayEntry;
window.requestRevision = requestRevision;
