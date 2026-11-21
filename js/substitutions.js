// ================================================================
//  SUBSTITUTIONS TAB
//  - Principal / vice principal / admin: pick any period of a date and assign a free teacher (works even if a
//    teacher is absent, or declined a request). Stored where the Timetable Editor keeps date overrides.
//  - Teachers: approve or decline requests from colleagues, and ask a colleague for one of their periods.
//  All rules are enforced by database functions (assign_substitute, request_takeover, respond_takeover, ...).
// ================================================================

const SUB_MANAGER_ROLES = ['principal', 'vice_principal', 'admin', 'super_admin'];
const SUB_TEACHER_ROLES = ['teacher', 'hod'];
window._subDate = window._subDate || null;

function subEsc(s) { return (typeof escHtml === 'function') ? escHtml(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function subTime(t) { return t ? String(t).slice(0, 5) : ''; }
function subToast(msg, kind) { if (typeof showToast === 'function') showToast(msg, kind || 'info'); else alert(msg); }
function subErr(e) { return (e && e.message) ? e.message : 'Something went wrong. Please try again.'; }

async function renderSubstitutionsTab() {
    const root = document.getElementById('substitutionsContent');
    if (!root) return;
    const role = window.currentUserRole || '';
    const isManager = SUB_MANAGER_ROLES.includes(role);
    const isTeacher = SUB_TEACHER_ROLES.includes(role);
    if (!isManager && !isTeacher) {
        root.innerHTML = '<p class="text-muted">Substitutions are available to teachers and the school office.</p>';
        return;
    }
    const today = (typeof getTodayStr === 'function') ? getTodayStr() : new Date().toISOString().slice(0, 10);
    if (!window._subDate) window._subDate = today;
    const date = window._subDate;

    root.innerHTML =
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">' +
        '<label for="subDate" style="font-weight:600">Date</label>' +
        '<input type="date" id="subDate" value="' + subEsc(date) + '"' + (isManager ? '' : ' min="' + today + '"') + '>' +
        '<button class="btn btn-secondary" id="subReload">↻ Refresh</button></div>' +
        '<div id="subBody"><div style="padding:16px"><span class="spinner"></span> Loading…</div></div>';
    document.getElementById('subDate').onchange = (e) => { window._subDate = e.target.value || today; renderSubstitutionsTab(); };
    document.getElementById('subReload').onclick = () => renderSubstitutionsTab();

    const client = getSupabaseClient();
    const body = document.getElementById('subBody');
    if (!client) { body.innerHTML = '<p class="text-muted">Not connected to the database.</p>'; return; }

    const sched = await client.rpc('get_day_schedule', { p_date: date });
    if (sched.error) { body.innerHTML = '<p style="color:#dc2626">' + subEsc(sched.error.message) + '</p>'; return; }
    const rows = sched.data || [];

    let html = '';
    if (isTeacher) {
        const reqs = await client.rpc('list_my_takeover_requests');
        const list = reqs.data || [];
        html += '<div class="card" style="margin-bottom:16px"><div class="card-title">📨 Requests waiting for your answer</div>';
        if (!list.length) html += '<p class="text-muted" style="margin:6px 0 0">No colleague is asking for your periods.</p>';
        list.forEach(r => {
            html += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--border)">' +
                '<div style="flex:1;min-width:220px"><b>' + subEsc(r.requester_name) + '</b> wants your period <b>P' + r.period_number + '</b> (' + subEsc(r.class_section) + ') on <b>' + subEsc(r.related_date) + '</b></div>' +
                '<button class="btn btn-primary" data-resp="' + r.id + '" data-accept="1">Approve</button>' +
                '<button class="btn btn-secondary" data-resp="' + r.id + '" data-accept="0">Decline</button></div>';
        });
        html += '</div>';

        // periods I could ask for: other teachers' periods in slots where I have no class
        const mine = await client.rpc('get_my_periods', { p_date: date });
        const busy = new Set((mine.data || []).map(p => p.period_number));
        const sess = await client.auth.getSession();
        const myId = (sess.data && sess.data.session && sess.data.session.user.id) || null;
        const canAsk = rows.filter(r => r.teacher_user_id && r.teacher_user_id !== myId && !busy.has(r.period_number));
        html += '<div class="card"><div class="card-title">🙋 Ask a colleague for one of their periods</div>' +
            '<p class="text-muted" style="margin:4px 0 8px">Only periods where you are free are listed. The other teacher must approve; the principal can also arrange it.</p>';
        if (date < today) html += '<p class="text-muted">Pick today or a future date.</p>';
        else if (!canAsk.length) html += '<p class="text-muted">No periods available to request on this date.</p>';
        else {
            html += '<div style="overflow:auto"><table class="data-table" style="width:100%;border-collapse:collapse"><thead><tr><th>Period</th><th>Time</th><th>Class</th><th>Subject</th><th>Teacher</th><th></th></tr></thead><tbody>';
            canAsk.forEach(r => {
                html += '<tr><td>P' + r.period_number + '</td><td>' + subTime(r.start_time) + '–' + subTime(r.end_time) + '</td><td>' + subEsc(r.class_section) + '</td><td>' + subEsc(r.subject) + '</td><td>' + subEsc(r.teacher_name || r.teacher_code) + '</td>' +
                    '<td><button class="btn btn-secondary" data-ask="' + subEsc(r.class_section) + '|' + r.period_number + '">Request</button></td></tr>';
            });
            html += '</tbody></table></div>';
        }
        html += '</div>';
    }

    if (isManager) {
        html += '<div class="card"><div class="card-title">👥 All periods on ' + subEsc(date) + '</div>' +
            '<p class="text-muted" style="margin:4px 0 8px">If a teacher is absent, choose a free teacher for that period. This overrides any pending request.</p>';
        if (!rows.length) html += '<p class="text-muted">No periods are scheduled on this date.</p>';
        else {
            html += '<div style="overflow:auto"><table class="data-table" style="width:100%;border-collapse:collapse"><thead><tr><th>Period</th><th>Time</th><th>Class</th><th>Subject</th><th>Teacher</th><th></th></tr></thead><tbody>';
            rows.forEach(r => {
                html += '<tr><td>P' + r.period_number + '</td><td>' + subTime(r.start_time) + '–' + subTime(r.end_time) + '</td><td>' + subEsc(r.class_section) + '</td><td>' + subEsc(r.subject) + '</td>' +
                    '<td>' + subEsc(r.teacher_name || r.teacher_code) + (r.substituted ? ' <span class="badge" style="background:#fef3c7;color:#92400e">substitute</span>' : '') + '</td><td style="white-space:nowrap">' +
                    '<button class="btn btn-secondary" data-assign="' + subEsc(r.class_section) + '|' + r.period_number + '">Assign substitute</button>' +
                    (r.substituted ? ' <button class="btn btn-secondary" data-clear="' + subEsc(r.class_section) + '|' + r.period_number + '">Undo</button>' : '') + '</td></tr>';
            });
            html += '</tbody></table></div>';
        }
        html += '</div>';
    }
    body.innerHTML = html;

    body.querySelectorAll('[data-resp]').forEach(b => b.onclick = async () => {
        b.disabled = true;
        const r = await client.rpc('respond_takeover', { p_request_id: b.dataset.resp, p_accept: b.dataset.accept === '1' });
        if (r.error) { subToast(subErr(r.error), 'error'); b.disabled = false; return; }
        subToast(b.dataset.accept === '1' ? 'Approved. The period moves to your colleague.' : 'Request declined.', 'success');
        renderSubstitutionsTab(); if (typeof fetchNotifications === 'function') fetchNotifications();
    });
    body.querySelectorAll('[data-ask]').forEach(b => b.onclick = async () => {
        const [cs, pn] = b.dataset.ask.split('|'); b.disabled = true;
        const r = await client.rpc('request_takeover', { p_date: date, p_class_section: cs, p_period: parseInt(pn, 10) });
        if (r.error) { subToast(subErr(r.error), 'error'); b.disabled = false; return; }
        subToast('Request sent. You will be notified when the teacher answers.', 'success'); b.textContent = 'Requested';
    });
    body.querySelectorAll('[data-assign]').forEach(b => b.onclick = () => { const [cs, pn] = b.dataset.assign.split('|'); openAssignDialog(client, date, cs, parseInt(pn, 10)); });
    body.querySelectorAll('[data-clear]').forEach(b => b.onclick = async () => {
        const [cs, pn] = b.dataset.clear.split('|');
        if (!confirm('Remove the substitute for P' + pn + ' (' + cs + ') and give the period back to the original teacher?')) return;
        const r = await client.rpc('clear_substitution', { p_date: date, p_class_section: cs, p_period: parseInt(pn, 10) });
        if (r.error) { subToast(subErr(r.error), 'error'); return; }
        subToast('Substitute removed.', 'success'); renderSubstitutionsTab();
    });
}

async function openAssignDialog(client, date, cs, pn) {
    const res = await client.rpc('list_substitute_candidates', { p_date: date, p_period: pn });
    if (res.error) { subToast(subErr(res.error), 'error'); return; }
    const cands = res.data || [];
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:100003;background:rgba(15,23,42,.6);display:flex;align-items:center;justify-content:center';
    o.innerHTML = '<div style="background:var(--bg-card,#fff);color:var(--text,#0f172a);border-radius:12px;padding:20px;width:min(420px,92vw)">' +
        '<h3 style="margin:0 0 4px">Assign substitute</h3><p class="text-muted" style="margin:0 0 12px">P' + pn + ' · ' + subEsc(cs) + ' · ' + subEsc(date) + '</p>' +
        (cands.length
            ? '<select id="subPick" style="width:100%;padding:10px;margin-bottom:8px">' + cands.map(c => '<option value="' + c.user_id + '">' + subEsc(c.name) + ' (' + subEsc(c.code) + ')</option>').join('') + '</select>' +
              '<input id="subReason" placeholder="Reason (optional), e.g. teacher on leave" style="width:100%;padding:10px;margin-bottom:12px;box-sizing:border-box">'
            : '<p style="color:#dc2626">No teacher is free in this period.</p>') +
        '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-secondary" id="subCancel">Cancel</button>' +
        (cands.length ? '<button class="btn btn-primary" id="subOk">Assign</button>' : '') + '</div></div>';
    document.body.appendChild(o);
    document.getElementById('subCancel').onclick = () => o.remove();
    const ok = document.getElementById('subOk');
    if (ok) ok.onclick = async () => {
        ok.disabled = true;
        const r = await client.rpc('assign_substitute', { p_date: date, p_class_section: cs, p_period: pn, p_substitute: document.getElementById('subPick').value, p_reason: document.getElementById('subReason').value.trim() || null });
        if (r.error) { subToast(subErr(r.error), 'error'); ok.disabled = false; return; }
        o.remove(); subToast('Substitute assigned. Both teachers were notified.', 'success'); renderSubstitutionsTab();
    };
}

window.renderSubstitutionsTab = renderSubstitutionsTab;
