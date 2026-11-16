/**
 * Teacher Diary - Lab PIN & Student Management Module
 * Integrated with Centralized Supabase Database (smart-school-automation)
 */

(function () {
  'use strict';

  let currentStudents = [];

  function initLabManagement() {
    setupTabSwitching();
    setupPinGenerator();
    setupStudentSearch();
  }

  function setupTabSwitching() {
    const tabNav = document.getElementById('tabNav');
    if (!tabNav) return;

    tabNav.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      const tabName = btn.getAttribute('data-tab');

      if (tabName === 'labpins') {
        loadActivePins();
      } else if (tabName === 'students') {
        loadStudentsDirectory();
      }
    });
  }

  // -------------------------------------------------------------
  // TAB 1: SHARED COMPUTER ACCESS (LAB PINS)
  // -------------------------------------------------------------
  function setupPinGenerator() {
    const form = document.getElementById('form-generate-pin');
    if (!form) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-gen-pin-submit');
      btn.disabled = true;
      btn.textContent = 'Generating PIN...';

      const targetClass = document.getElementById('pin-target-class').value;
      const targetSection = document.getElementById('pin-target-section').value;
      const durationMins = parseInt(document.getElementById('pin-duration').value, 10) || 60;
      const maxUsesVal = document.getElementById('pin-max-uses').value;
      const maxUses = maxUsesVal ? parseInt(maxUsesVal, 10) : null;
      const customPin = document.getElementById('pin-custom-code').value.trim();

      try {
        const res = await SchoolAuth.teacherGeneratePin({
          targetClass: targetClass || null,
          targetSection: targetSection || null,
          durationMinutes: durationMins,
          maxUses: maxUses,
          customPin: customPin || null
        });

        // Show prominent PIN display banner
        const resultBanner = document.getElementById('pin-result-banner');
        if (resultBanner) {
          resultBanner.style.display = 'block';
          document.getElementById('pin-display-code').textContent = res.pin_code;
          document.getElementById('pin-display-expires').textContent = new Date(res.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          document.getElementById('pin-display-class').textContent = res.target_class ? `Class ${res.target_class}${res.target_section ? '-' + res.target_section : ''}` : 'All Classes';
        }

        form.reset();
        await loadActivePins();
      } catch (err) {
        alert('Failed to generate PIN: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Temporary PIN';
      }
    };
  }

  async function loadActivePins() {
    const container = document.getElementById('active-pins-list');
    if (!container) return;
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;">Loading active PINs...</div>';

    try {
      const pins = await SchoolAuth.teacherGetActivePins();
      if (!pins || pins.length === 0) {
        container.innerHTML = '<div style="padding:24px;text-align:center;color:#64748b;font-size:13px;">No active PINs currently running. Generate a new PIN above for computer lab sessions.</div>';
        return;
      }

      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
          ${pins.map(p => {
            const expires = new Date(p.expires_at);
            const isExpired = expires < new Date();
            const target = p.target_class ? `Class ${p.target_class}${p.target_section ? '-' + p.target_section : ''}` : 'All Classes';
            return `
              <div style="background:#ffffff;border:1.5px solid #e2e8f0;border-radius:14px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <span style="font-size:11px;font-weight:700;color:#2563eb;background:#eff6ff;padding:3px 8px;border-radius:12px;">${target}</span>
                  <span style="font-size:11px;font-weight:700;color:${isExpired ? '#dc2626' : '#059669'};background:${isExpired ? '#fef2f2' : '#ecfdf5'};padding:3px 8px;border-radius:12px;">
                    ${isExpired ? 'Expired' : 'Active'}
                  </span>
                </div>
                <div style="font-size:26px;font-weight:800;letter-spacing:4px;color:#0f172a;margin:6px 0;font-family:monospace;">
                  ${p.pin_code}
                </div>
                <div style="font-size:12px;color:#64748b;margin-bottom:12px;">
                  <div>🕒 Expires: <strong>${expires.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> (${expires.toLocaleDateString()})</div>
                  <div>👥 Uses: <strong>${p.current_uses}</strong> ${p.max_uses ? `/ ${p.max_uses} limit` : '(unlimited)'}</div>
                </div>
                <button type="button" onclick="window.handleRevokePin('${p.id}')" style="width:100%;padding:8px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
                  Revoke PIN
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="padding:16px;color:#dc2626;font-size:13px;">Error loading active PINs: ${err.message}</div>`;
    }
  }

  window.handleRevokePin = async function (pinId) {
    if (!confirm('Are you sure you want to deactivate and revoke this PIN immediately? Students using this PIN will no longer be able to log in with it.')) return;
    try {
      await SchoolAuth.teacherRevokePin(pinId);
      await loadActivePins();
    } catch (err) {
      alert('Revoke error: ' + err.message);
    }
  };

  // -------------------------------------------------------------
  // TAB 2: STUDENT DIRECTORY & PASSWORD RESET
  // -------------------------------------------------------------
  function setupStudentSearch() {
    const searchInput = document.getElementById('student-mgmt-search');
    const classFilter = document.getElementById('student-mgmt-class');
    const secFilter = document.getElementById('student-mgmt-sec');

    const triggerSearch = debounce(() => {
      loadStudentsDirectory(
        searchInput ? searchInput.value.trim() : '',
        classFilter ? classFilter.value : '',
        secFilter ? secFilter.value : ''
      );
    }, 250);

    if (searchInput) searchInput.addEventListener('input', triggerSearch);
    if (classFilter) classFilter.addEventListener('change', triggerSearch);
    if (secFilter) secFilter.addEventListener('change', triggerSearch);
  }

  async function loadStudentsDirectory(search, classVal, secVal) {
    const tableBody = document.getElementById('students-mgmt-tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b;">Loading student directory from central database...</td></tr>';

    try {
      const students = await SchoolAuth.teacherGetStudents(search, classVal, secVal);
      currentStudents = students || [];

      if (currentStudents.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b;">No students found matching the search criteria.</td></tr>';
        return;
      }

      tableBody.innerHTML = currentStudents.map(s => {
        const isLocked = s.locked_until && new Date(s.locked_until) > new Date();
        return `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 14px;font-family:monospace;font-weight:700;color:#0f172a;">${s.admission_number}</td>
            <td style="padding:12px 14px;font-weight:700;color:#1e293b;">
              ${s.full_name}
              <div style="font-size:11px;color:#64748b;font-weight:normal;">UUID: ${s.id.substring(0, 8)}...</div>
            </td>
            <td style="padding:12px 14px;font-weight:600;">Class ${s.class}-${s.section}</td>
            <td style="padding:12px 14px;font-family:monospace;font-size:13px;color:#475569;">${s.phone_number || '---'}</td>
            <td style="padding:12px 14px;">
              <span style="display:inline-block;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${s.account_status === 'active' ? '#ecfdf5;color:#059669' : '#fef2f2;color:#dc2626'};">
                ${s.account_status.toUpperCase()}
              </span>
              ${isLocked ? '<span style="display:inline-block;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;background:#fffbeb;color:#b45309;margin-left:4px;">LOCKED</span>' : ''}
            </td>
            <td style="padding:12px 14px;">
              <span style="font-size:12px;color:${s.is_activated ? '#059669' : '#d97706'};font-weight:600;">
                ${s.is_activated ? '✓ Password Set' : '⚡ Not Activated'}
              </span>
            </td>
            <td style="padding:12px 14px;">
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button type="button" onclick="window.openResetModal('${s.id}', '${s.full_name}', '${s.admission_number}')" style="padding:5px 10px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">
                  🔑 Reset Pwd
                </button>
                <button type="button" onclick="window.viewStudentHistory('${s.id}', '${s.full_name}')" style="padding:5px 10px;background:#f8fafc;color:#475569;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
                  🕒 History
                </button>
                <button type="button" onclick="window.toggleStudentStatus('${s.id}', '${s.account_status}')" style="padding:5px 8px;background:none;border:none;color:${s.account_status === 'active' ? '#dc2626' : '#059669'};font-size:11px;font-weight:700;cursor:pointer;text-decoration:underline;">
                  ${s.account_status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;color:#dc2626;">Error: ${err.message}</td></tr>`;
    }
  }

  window.openResetModal = function (studentId, studentName, admissionNo) {
    const modal = document.getElementById('student-reset-modal');
    if (!modal) return;
    document.getElementById('reset-modal-name').textContent = `${studentName} (${admissionNo})`;
    document.getElementById('reset-modal-student-id').value = studentId;
    document.getElementById('reset-modal-temp-pwd').value = 'Student@' + Math.floor(100 + Math.random() * 900);
    modal.style.display = 'flex';
  };

  window.closeResetModal = function () {
    const modal = document.getElementById('student-reset-modal');
    if (modal) modal.style.display = 'none';
  };

  window.handleConfirmPasswordReset = async function (e) {
    if (e) e.preventDefault();
    const studentId = document.getElementById('reset-modal-student-id').value;
    const tempPassword = document.getElementById('reset-modal-temp-pwd').value.trim();
    if (!tempPassword || tempPassword.length < 6) {
      alert('Temporary password must be at least 6 characters.');
      return;
    }

    try {
      await SchoolAuth.teacherResetStudentPassword(studentId, tempPassword);
      alert(`Password successfully reset! Provide the temporary password "${tempPassword}" to the student. They will be prompted to set a new password upon login.`);
      closeResetModal();
      loadStudentsDirectory();
    } catch (err) {
      alert('Password reset failed: ' + err.message);
    }
  };

  window.toggleStudentStatus = async function (studentId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    if (!confirm(`Are you sure you want to change student status to ${newStatus.toUpperCase()}?`)) return;
    try {
      await SchoolAuth.teacherToggleStudentStatus(studentId, newStatus);
      loadStudentsDirectory();
    } catch (err) {
      alert('Status change error: ' + err.message);
    }
  };

  window.viewStudentHistory = async function (studentId, studentName) {
    const modal = document.getElementById('student-history-modal');
    if (!modal) return;
    document.getElementById('history-modal-name').textContent = `Login History: ${studentName}`;
    const list = document.getElementById('history-modal-list');
    list.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b;">Loading activity logs...</div>';
    modal.style.display = 'flex';

    try {
      const history = await SchoolAuth.teacherGetStudentHistory(studentId);
      if (!history || history.length === 0) {
        list.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b;">No login events recorded for this student yet.</div>';
        return;
      }
      list.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px;max-height:350px;overflow-y:auto;">
          ${history.map(h => `
            <div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-weight:700;color:#0f172a;">${h.application_name || 'Portal'} (${(h.login_method || 'PIN').toUpperCase()})</div>
                <div style="font-size:11px;color:#64748b;">${new Date(h.created_at).toLocaleString()}</div>
                ${h.failure_reason ? `<div style="font-size:11px;color:#dc2626;">Reason: ${h.failure_reason}</div>` : ''}
              </div>
              <span style="font-size:11px;font-weight:700;color:${h.status === 'success' ? '#059669' : '#dc2626'};background:${h.status === 'success' ? '#ecfdf5' : '#fef2f2'};padding:2px 8px;border-radius:10px;">
                ● ${h.status.toUpperCase()}
              </span>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      list.innerHTML = `<div style="padding:16px;color:#dc2626;">Error: ${err.message}</div>`;
    }
  };

  window.closeStudentHistoryModal = function () {
    const modal = document.getElementById('student-history-modal');
    if (modal) modal.style.display = 'none';
  };

  function debounce(fn, delay) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  window.addEventListener('DOMContentLoaded', initLabManagement);
})();
