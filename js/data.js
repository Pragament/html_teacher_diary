// ================================================================
//  DATA MANAGER
// ================================================================
// Use a separate storage key if Offline Mode is active
function getStorageKey() {
    return localStorage.getItem('offlineMode') === 'true' 
        ? 'teacherPlannerData_Offline' 
        : 'teacherPlannerData';
}

function getDefaultData() {
    return {
        activities: [],
        settings: {
            periodsPerDay: 8,
            supabaseUrl: window.ENV?.SUPABASE_URL || '',
            supabaseKey: window.ENV?.SUPABASE_KEY || '',
            supabaseTable: 'daily_entries',
            curriculumBoard: 'CBSE',
            curriculumClass: '10',
            curriculumSubject: 'Mathematics',
            curriculumFileType: 'topics'
        }
    };
}

function loadData() {
    try {
        const raw = localStorage.getItem(getStorageKey());
        if (!raw) return getDefaultData();
        const parsed = JSON.parse(raw);
        if (!parsed.settings) parsed.settings = getDefaultData().settings;
        if (!parsed.activities) parsed.activities = [];
        
        const currentEmail = localStorage.getItem('lastLoggedInEmail');
        if (currentEmail) {
            let migrated = false;
            parsed.activities.forEach(a => {
                if (!a.teacher_email) {
                    a.teacher_email = currentEmail;
                    migrated = true;
                }
            });
            if (migrated) {
                // We don't call saveData to avoid recursion/loops, just write to localStorage directly
                localStorage.setItem(getStorageKey(), JSON.stringify(parsed));
            }
        }
        
        // Wipe default developer credentials for existing user migrations (one-time check)
        if (localStorage.getItem('isCredentialsWiped') !== 'true') {
            const defaultUrl1 = 'https://syjhiqlfjieihhpymwdz.supabase.co';
            const defaultUrl2 = 'https://syjhiqlfjieihhpymwd.supabase.co';
            const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5amhpcWxmamllaWhocHltd2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDI5ODksImV4cCI6MjA5Nzk3ODk4OX0.AUeZ8FmGQ5ZcANqnzwzKN-0wgf4c8VJRnVjVu_9kqt0';
            
            let changed = false;
            if (parsed.settings) {
                if (parsed.settings.supabaseUrl === defaultUrl1 || parsed.settings.supabaseUrl === defaultUrl2) {
                    parsed.settings.supabaseUrl = '';
                    changed = true;
                }
                if (parsed.settings.supabaseKey === defaultKey) {
                    parsed.settings.supabaseKey = '';
                    changed = true;
                }
                if (changed) {
                    localStorage.setItem(getStorageKey(), JSON.stringify(parsed));
                }
            }
            localStorage.setItem('isCredentialsWiped', 'true');
        }
        
        return parsed;
    } catch {
        return getDefaultData();
    }
}

function saveData(data) {
    localStorage.setItem(getStorageKey(), JSON.stringify(data));
}

function getSettings() {
    const data = loadData();
    return data.settings;
}

function saveSettings(settings) {
    const data = loadData();
    data.settings = settings;
    
    saveData(data);
}

function getActivities() {
    const data = loadData();
    return data.activities;
}

function saveActivities(activities) {
    const data = loadData();
    data.activities = activities;
    saveData(data);
}

function generateId() {
    return 'day_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function getTodayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function getDayEntry(dateStr) {
    const activities = getActivities();
    const currentEmail = localStorage.getItem('lastLoggedInEmail');
    return activities.find(a => a.date === dateStr && (!currentEmail || a.teacher_email === currentEmail)) || null;
}

function saveDayEntry(dateStr, periods) {
    const activities = getActivities();
    const existing = activities.findIndex(a => a.date === dateStr);
    const email = localStorage.getItem('lastLoggedInEmail') || 'unknown';
    
    let entry;
    if (existing >= 0) {
        entry = activities[existing];
        entry.periods = periods;
        entry.teacher_email = email;
        activities[existing] = entry;
    } else {
        entry = { id: generateId(), date: dateStr, periods: periods, teacher_email: email };
        activities.push(entry);
    }
    
    saveActivities(activities);
    return entry;
}

function deleteDayEntry(dateStr) {
    let activities = getActivities();
    const currentEmail = localStorage.getItem('lastLoggedInEmail');
    activities = activities.filter(a => !(a.date === dateStr && (!currentEmail || a.teacher_email === currentEmail)));
    saveActivities(activities);
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}
