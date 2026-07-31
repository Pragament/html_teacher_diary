const fs = require('fs');
let ui = fs.readFileSync('js/ui.js', 'utf8');

// 1. Remove the duplicated deleteDay and editDay
ui = ui.replace(`function editDay(dateStr) {
    document.querySelector('[data-tab="daily"]').click();
    document.getElementById('dailyDate').value = dateStr;
    renderDailyTab();
    showToast(\`✏️ Editing \${formatDate(dateStr)}\`, 'info');
}

function deleteDay(dateStr) {
    if (!confirm(\`Delete entry for \${formatDate(dateStr)}?\`)) return;
    deleteDayEntry(dateStr);
    showToast(\`🗑 Deleted \${formatDate(dateStr)}\`, 'warning');
    renderViewTab();
    updateBadge();
    const dailyDate = document.getElementById('dailyDate').value;
    if (dailyDate === dateStr) renderDailyTab();
}`, '');

// 2. Append applyRoleBasedUI to the end if not there
if (!ui.includes('function applyRoleBasedUI(role)')) {
    ui += `\n// ================================================================
//  ROLE BASED UI
// ================================================================
function applyRoleBasedUI(role) {
    const adminTabBtn = document.querySelector('[data-tab="admin"]');
    const principalTabBtn = document.querySelector('[data-tab="principal"]');
    
    if (adminTabBtn) {
        adminTabBtn.style.display = (role === 'admin' || role === 'super_admin') ? 'inline-block' : 'none';
    }
    
    if (principalTabBtn) {
        principalTabBtn.style.display = (role === 'principal' || role === 'admin' || role === 'super_admin') ? 'inline-block' : 'none';
    }
}
window.applyRoleBasedUI = applyRoleBasedUI;
`;
}

fs.writeFileSync('js/ui.js', ui);
console.log('ui.js fixed successfully');
