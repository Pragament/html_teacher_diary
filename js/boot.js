window.App = {
    supabase: null,
    school: null
};

(async function boot() {
    const isOfflineMode = localStorage.getItem('offlineMode') === 'true';
    if (isOfflineMode) {
        // If offline mode is enabled, we skip the school connect flow
        // and just dispatch appReady so the rest of the app can load
        window.dispatchEvent(new CustomEvent('appReady', { detail: { mode: 'offline' } }));
        return;
    }

    const schoolDataRaw = localStorage.getItem('teacherDiary.school');
    let storedSchool = null;
    
    if (schoolDataRaw) {
        try {
            storedSchool = JSON.parse(schoolDataRaw);
        } catch (e) {
            console.warn("Invalid school data in localStorage.");
        }
    }

    if (storedSchool && storedSchool.schoolCode) {
        // Verify with remote json
        await verifyAndConnectSchool(storedSchool.schoolCode);
    } else {
        // Check if we are on dashboard without a school, if so, redirect to index
        if (window.location.pathname.endsWith('dashboard.html')) {
             window.location.href = 'index.html';
             return;
        }
        // Dispatch appReady so the landing page can finish loading normally
        window.dispatchEvent(new CustomEvent('appReady', { detail: null }));
    }
})();

async function verifyAndConnectSchool(code) {
    const overlay = document.getElementById('school-code-overlay');
    const errorMsg = document.getElementById('school-code-error');
    const submitBtn = document.getElementById('school-code-submit-btn');
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Connecting...';
    }
    if (errorMsg) errorMsg.style.display = 'none';

    try {
        const response = await fetch('config/schools.v1.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to fetch school configuration');
        
        const schools = await response.json();
        const schoolConfig = schools[code];

        if (!schoolConfig) {
            if (errorMsg) {
                errorMsg.innerHTML = "School not found.<br>Please verify the code provided by your school administrator.";
                errorMsg.style.display = 'block';
            }
            if (overlay) overlay.classList.add('active');
            localStorage.removeItem('teacherDiary.school'); // clear invalid state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Connect';
            }
            return;
        }

        if (schoolConfig.status !== 'active') {
            if (errorMsg) {
                errorMsg.innerHTML = "This school is currently unavailable.<br>Contact your administrator.";
                errorMsg.style.display = 'block';
            }
            if (overlay) overlay.classList.add('active');
            localStorage.removeItem('teacherDiary.school'); // clear invalid state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Connect';
            }
            return;
        }

        // Initialize Supabase
        if (window.supabase) {
            window.App.supabase = window.supabase.createClient(schoolConfig.supabaseUrl, schoolConfig.anonKey);
        }

        // Store active school state
        window.App.school = {
            schoolCode: code,
            schoolName: schoolConfig.schoolName,
            connectedAt: new Date().toISOString(),
            version: 1
        };

        localStorage.setItem('teacherDiary.school', JSON.stringify(window.App.school));

        if (overlay) overlay.classList.remove('active');
        
        // Notify rest of the app
        window.dispatchEvent(new CustomEvent('appReady', { 
            detail: { 
                schoolCode: code, 
                schoolName: schoolConfig.schoolName 
            } 
        }));

        if (window._pendingAuthTab) {
            const authOverlay = document.getElementById('auth-overlay');
            if (authOverlay) authOverlay.classList.add('active');
            if (typeof window.switchAuthTab === 'function') window.switchAuthTab(window._pendingAuthTab);
            window._pendingAuthTab = null;
        }

    } catch (err) {
        console.error("Error connecting to school:", err);
        if (errorMsg) {
            errorMsg.innerHTML = "An error occurred while connecting. Please check your internet and try again.";
            errorMsg.style.display = 'block';
        }
        if (overlay) overlay.classList.add('active');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Connect';
        }
    }
}

// Global functions for the UI
window.handleSchoolCodeSubmit = function(event) {
    if (event) event.preventDefault();
    const input = document.getElementById('school-code-input');
    const code = input.value.trim().toUpperCase();
    
    if (!code) {
        const errorMsg = document.getElementById('school-code-error');
        if (errorMsg) {
            errorMsg.textContent = 'Please enter a school code.';
            errorMsg.style.display = 'block';
        }
        return;
    }
    
    verifyAndConnectSchool(code);
};

window.changeSchool = function() {
    localStorage.removeItem('teacherDiary.school');
    // Also clear supabase auth tokens by signing out if possible, but simplest is to clear localstorage completely for supabase?
    // Let's just clear school and auth state then reload
    localStorage.removeItem('userRole');
    localStorage.removeItem('lastLoggedInEmail');
    
    // Attempt to sign out of supabase if possible before reloading
    if (window.App && window.App.supabase) {
        window.App.supabase.auth.signOut().then(() => {
            window.location.reload();
        }).catch(() => {
            window.location.reload();
        });
    } else {
        window.location.reload();
    }
};

window.openLoginFlow = function(tab) {
    if (window.App && window.App.school && window.App.school.schoolCode) {
        const authOverlay = document.getElementById('auth-overlay');
        if (authOverlay) authOverlay.classList.add('active');
        if (typeof window.switchAuthTab === 'function') window.switchAuthTab(tab);
    } else {
        window._pendingAuthTab = tab;
        const schoolOverlay = document.getElementById('school-code-overlay');
        if (schoolOverlay) schoolOverlay.classList.add('active');
    }
};
