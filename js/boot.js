// ================================================================
//  BOOTSTRAP & TENANT INITIALIZATION
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    const code = localStorage.getItem("schoolCode");
    if (code) {
        loadSchoolConfig(code);
    } else {
        const overlay = document.getElementById('school-code-overlay');
        if (overlay) overlay.classList.add('active');
    }
});

async function loadSchoolConfig(code) {
    try {
        const response = await fetch("config/schools.json");
        const data = await response.json();
        
        const school = data.schools.find(
            s => s.code.toUpperCase() === code.toUpperCase()
        );

        if (!school) {
            showSchoolCodeError("Invalid School Code");
            localStorage.removeItem("schoolCode"); // clear if invalid
            const overlay = document.getElementById('school-code-overlay');
            if (overlay) overlay.classList.add('active');
            return;
        }

        // Store valid code
        localStorage.setItem("schoolCode", school.code);

        // Initialize Supabase Client dynamically
        if (window.supabase) {
            window.supabaseClient = window.supabase.createClient(
                school.url,
                school.anonKey
            );
        } else {
            console.warn("Supabase SDK not loaded yet.");
        }

        // Hide overlay if active
        const overlay = document.getElementById('school-code-overlay');
        if (overlay) overlay.classList.remove('active');

        // Start the app
        if (typeof window.initApp === 'function') {
            window.initApp();
        }
    } catch (e) {
        console.error("Failed to load school config:", e);
        showSchoolCodeError("Failed to load configuration. Please try again.");
    }
}

function handleSchoolCodeSubmit(event) {
    if (event) event.preventDefault();
    const input = document.getElementById('schoolCodeInput');
    const code = input ? input.value.trim() : '';
    
    if (!code) {
        showSchoolCodeError("Please enter a school code.");
        return;
    }
    
    // Clear previous errors
    const errorEl = document.getElementById('schoolCodeError');
    if (errorEl) errorEl.style.display = 'none';

    const submitBtn = document.getElementById('submitSchoolCodeBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Loading...';
    }
    
    loadSchoolConfig(code).finally(() => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Continue';
        }
    });
}

function bypassSchoolCode() {
    // Only if local offline mode is allowed without a school
    const overlay = document.getElementById('school-code-overlay');
    if (overlay) overlay.classList.remove('active');
    if (typeof window.initApp === 'function') {
        window.initApp();
    }
}

function showSchoolCodeError(msg) {
    const errorEl = document.getElementById('schoolCodeError');
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    } else {
        alert(msg); // Fallback
    }
}

window.handleSchoolCodeSubmit = handleSchoolCodeSubmit;
window.bypassSchoolCode = bypassSchoolCode;
