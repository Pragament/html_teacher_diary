// ================================================================
//  ACCOUNTS PANEL (admin / principal)
//  Creates and manages Supabase Auth accounts through the `manage-account` Edge Function. The browser never holds a
//  service-role key: the function verifies the caller's role and performs the privileged work server-side.
//  The timetable itself is edited ONLY in the Timetable Editor (public.timetable is its single source of truth).
// ================================================================

const ACCOUNT_CREATABLE = {
    super_admin: ['admin', 'principal', 'vice_principal', 'hod', 'teacher', 'accountant', 'student'],
    admin: ['principal', 'vice_principal', 'hod', 'teacher', 'accountant', 'student'],
    principal: ['teacher', 'hod', 'student'],
    vice_principal: ['teacher', 'student']
};
const ACCOUNT_ROLE_LABEL = { admin: 'Admin', super_admin: 'Super admin', principal: 'Principal', vice_principal: 'Vice principal', hod: 'HOD', teacher: 'Teacher', accountant: 'Accountant', student: 'Student' };

function accountsCallerRole() {
    return window.currentUserRole || localStorage.getItem('userRole') || '';
}

async function callManageAccount(body) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Not connected to the school server');
    const { data, error } = await client.functions.invoke('manage-account', { body });
    if (error) {
        let msg = error.message;
        try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) { /* keep message */ }
        throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
}

function renderAdminPanel() {
    const container = document.getElementById('adminPanelContent');
    if (!container) return;
    const roles = ACCOUNT_CREATABLE[accountsCallerRole()] || [];
    if (!roles.length) {
        container.innerHTML = '<p style="color:var(--text-muted)">Your role cannot manage accounts.</p>';
        return;
    }
    const roleOptions = roles.map(r => `<option value="${r}">${ACCOUNT_ROLE_LABEL[r] || r}</option>`).join('');
    const inp = 'style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;box-sizing:border-box"';
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
            <div class="card" style="margin-bottom:0;">
                <h4>Create account</h4>
                <p style="font-size:13px; color:var(--text-muted); margin:4px 0 12px;">A sign-in is created for the person and a one-time temporary password is shown below. Share it with them securely; they should change it after the first login.</p>
                <form id="acctForm" onsubmit="submitCreateAccount(event)" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">
                    <label>Role<select id="acctRole" ${inp} onchange="toggleAccountFields()">${roleOptions}</select></label>
                    <label>Full name<input id="acctName" required ${inp} /></label>
                    <label>Email<input id="acctEmail" type="email" required ${inp} /></label>
                    <div id="acctStaffFields" style="display:contents">
                        <label>Employee ID<input id="acctEmpId" ${inp} placeholder="must match the teacher code in the Timetable Editor" /></label>
                        <label>Department<input id="acctDept" ${inp} /></label>
                        <label>Designation<input id="acctDesig" ${inp} /></label>
                        <label>Mobile number<input id="acctMobile" ${inp} /></label>
                        <label>Joining date<input id="acctJoin" type="date" ${inp} /></label>
                    </div>
                    <div id="acctStudentFields" style="display:none">
                        <label>Admission number<input id="acctAdm" ${inp} /></label>
                        <label>Class<input id="acctClass" ${inp} /></label>
                        <label>Section<input id="acctSection" ${inp} /></label>
                        <label>Roll number<input id="acctRoll" ${inp} /></label>
                    </div>
                    <div style="grid-column:1/-1"><button class="btn btn-primary" id="acctSubmit" type="submit">Create account</button></div>
                </form>
                <div id="acctResult" style="margin-top:12px;font-size:13px;"></div>
            </div>
            <div class="card" style="margin-bottom:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <h4>Directory</h4>
                    <button class="btn btn-outline btn-sm" onclick="loadAccountDirectory()">Refresh</button>
                </div>
                <div id="acctDirectory" style="margin-top:8px;font-size:13px;">Loading…</div>
            </div>
        </div>`;
    toggleAccountFields();
    loadAccountDirectory();
}

function toggleAccountFields() {
    const role = (document.getElementById('acctRole') || {}).value;
    const staff = ['teacher', 'hod'].includes(role);
    const student = role === 'student';
    const sf = document.getElementById('acctStaffFields'), st = document.getElementById('acctStudentFields');
    if (sf) { sf.style.display = staff ? 'contents' : 'none'; }
    if (st) { st.style.display = student ? 'contents' : 'none'; }
    ['acctEmpId', 'acctDept', 'acctDesig', 'acctMobile', 'acctJoin'].forEach(id => { const e = document.getElementById(id); if (e) e.required = staff; });
    const adm = document.getElementById('acctAdm'); if (adm) adm.required = student;
}

async function submitCreateAccount(ev) {
    ev.preventDefault();
    const v = id => (document.getElementById(id).value || '').trim();
    const role = v('acctRole');
    const body = { action: 'create_user', role, name: v('acctName'), email: v('acctEmail') };
    if (['teacher', 'hod'].includes(role)) {
        body.faculty = { employee_id: v('acctEmpId'), department: v('acctDept'), designation: v('acctDesig'), mobile_number: v('acctMobile'), joining_date: v('acctJoin') };
    }
    if (role === 'student') {
        body.student = { admission_number: v('acctAdm'), class: v('acctClass') || null, section: v('acctSection') || null, roll_number: v('acctRoll') || null };
    }
    const btn = document.getElementById('acctSubmit'), out = document.getElementById('acctResult');
    btn.disabled = true; btn.textContent = 'Creating…'; out.textContent = '';
    try {
        const res = await callManageAccount(body);
        out.innerHTML = `<div style="padding:10px;border-radius:8px;background:#dcfce7;color:#166534;">✅ Account created for <b>${escHtml(res.email)}</b> (${escHtml(ACCOUNT_ROLE_LABEL[res.role] || res.role)}).<br>
            Temporary password: <code id="acctTempPw" style="font-size:14px;user-select:all">${escHtml(res.temporary_password)}</code>
            <button class="btn btn-outline btn-sm" type="button" onclick="navigator.clipboard.writeText(document.getElementById('acctTempPw').textContent)">Copy</button><br>
            <span style="font-size:12px">Shown only once. The user can sign in now.</span></div>`;
        document.getElementById('acctForm').reset(); toggleAccountFields();
        loadAccountDirectory();
    } catch (e) {
        out.innerHTML = `<div style="padding:10px;border-radius:8px;background:#fee2e2;color:#991b1b;">❌ ${escHtml(e.message)}</div>`;
    } finally {
        btn.disabled = false; btn.textContent = 'Create account';
    }
}

async function loadAccountDirectory() {
    const box = document.getElementById('acctDirectory');
    if (!box) return;
    const client = getSupabaseClient();
    const { data, error } = await client.from('users').select('id,name,email,role,is_active').order('role').order('name');
    if (error) { box.innerHTML = `<span style="color:#991b1b">Could not load directory: ${escHtml(error.message)}</span>`; return; }
    const me = (await client.auth.getSession()).data.session?.user?.id;
    const manageable = new Set(ACCOUNT_CREATABLE[accountsCallerRole()] || []);
    box.innerHTML = `<table style="width:100%;border-collapse:collapse">
        <thead><tr style="text-align:left;border-bottom:1px solid var(--border)"><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>` +
        (data || []).map(u => {
            const can = manageable.has(u.role) && u.id !== me;
            return `<tr style="border-bottom:1px solid var(--border)">
                <td>${escHtml(u.name || '')}</td><td>${escHtml(u.email)}</td><td>${escHtml(ACCOUNT_ROLE_LABEL[u.role] || u.role)}</td>
                <td>${u.is_active ? '🟢 Active' : '⚪ Deactivated'}</td>
                <td style="text-align:right;white-space:nowrap">${can ? `
                    <button class="btn btn-outline btn-sm" onclick="setAccountActive('${u.id}', ${!u.is_active})">${u.is_active ? 'Deactivate' : 'Activate'}</button>
                    <button class="btn btn-outline btn-sm" onclick="resetAccountPassword('${u.id}', '${escHtml(u.email)}')">Reset password</button>` : ''}</td></tr>`;
        }).join('') + '</tbody></table>';
}

async function setAccountActive(userId, active) {
    if (!confirm(active ? 'Re-activate this account?' : 'Deactivate this account? They will no longer be able to sign in.')) return;
    try { await callManageAccount({ action: 'set_active', user_id: userId, active }); showToast(active ? 'Account activated' : 'Account deactivated', 'success'); loadAccountDirectory(); }
    catch (e) { showToast('Failed: ' + e.message, 'error'); }
}

async function resetAccountPassword(userId, email) {
    if (!confirm('Reset the password for ' + email + '?')) return;
    try {
        const res = await callManageAccount({ action: 'reset_password', user_id: userId });
        const out = document.getElementById('acctResult');
        if (out) out.innerHTML = `<div style="padding:10px;border-radius:8px;background:#dcfce7;color:#166534;">New temporary password for <b>${escHtml(email)}</b>: <code style="user-select:all">${escHtml(res.temporary_password)}</code></div>`;
    } catch (e) { showToast('Failed: ' + e.message, 'error'); }
}

// Intercept tab changes to render the accounts panel
document.addEventListener('DOMContentLoaded', () => {
    const adminBtn = document.querySelector('button[data-tab="admin"]');
    if (adminBtn) {
        adminBtn.addEventListener('click', renderAdminPanel);
        adminBtn.textContent = '👥 Accounts';
    }
});

window.renderAdminPanel = renderAdminPanel;
window.toggleAccountFields = toggleAccountFields;
window.submitCreateAccount = submitCreateAccount;
window.loadAccountDirectory = loadAccountDirectory;
window.setAccountActive = setAccountActive;
window.resetAccountPassword = resetAccountPassword;
