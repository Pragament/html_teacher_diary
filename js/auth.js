// ================================================================
//  AUTH SERVICE (Supabase only - no local storage)
// ================================================================

function isSupabaseConfigValid() {
    return !!(window.App && window.App.supabase);
}

// ================================================================
//  AUTH UI LOGIC
// ================================================================
let isBypassedAuth = false; // offline/demo bypass removed
let currentAuthTab = 'login';
let authListenerBound = false;
let currentBoundClientConfig = '';
let initialSessionResolved = false; // guards against premature null-session events

function showAuthAlert(message, type = 'error') {
    const alertEl = document.getElementById('auth-alert');
    if (!alertEl) return;
    alertEl.className = 'auth-alert ' + type;
    alertEl.innerHTML = message;
    alertEl.style.display = 'block';
}

function clearAuthAlert() {
    const alertEl = document.getElementById('auth-alert');
    if (alertEl) alertEl.style.display = 'none';
}

function switchAuthTab(tab) {
    // Public registration was removed: accounts are created by a principal/admin (manage-account function).
    currentAuthTab = 'login';
    clearAuthAlert();
}

// Loads the signed-in user's profile row. The role ALWAYS comes from public.users (never from the browser).
async function fetchActiveProfile(client, userId) {
    const { data, error } = await client.from('users').select('id,name,email,role,is_active').eq('id', userId).maybeSingle();
    if (error) return { ok: false, retryable: true, message: 'Could not load your profile (' + error.message + '). Please try again.' };
    if (!data) return { ok: false, message: 'No school profile is linked to this account. Please contact your administrator.' };
    if (!data.is_active) return { ok: false, message: 'This account has been deactivated. Please contact your principal.' };
    if (['student', 'accountant'].includes(data.role)) return { ok: false, message: 'The Teacher Diary is for teaching staff. Your role (' + data.role + ') does not have access to it.' };
    return { ok: true, profile: data };
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('auth-submit-btn');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Signing in...';

    try {
        clearAuthAlert();
        const client = isSupabaseConfigValid() ? getSupabaseClient() : null;
        if (!client) {
            showAuthAlert('⚠️ Could not connect to the school server. Check your internet connection and reload the page.');
            return;
        }

        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
            if (/Invalid login credentials/i.test(error.message)) showAuthAlert('Incorrect email or password.');
            else if (/Email not confirmed/i.test(error.message)) showAuthAlert('Your email is not confirmed. Please contact your administrator.');
            else if (/banned|disabled|deactivated/i.test(error.message)) showAuthAlert('This account has been deactivated. Please contact your principal.');
            else showAuthAlert(error.message);
            return;
        }

        const check = await fetchActiveProfile(client, data.user.id);
        if (!check.ok) {
            await client.auth.signOut();
            showAuthAlert(check.message);
            return;
        }
        localStorage.setItem('lastLoggedInEmail', email);
        window.location.href = 'dashboard.html';
    } catch (err) {
        showAuthAlert(err.message || 'Sign in failed. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
    }
}

async function handleGoogleSignIn(event) {
    if (event) event.preventDefault();
    
    if (!isSupabaseConfigValid()) {
        showToast('⚠️ Supabase is not configured. Please set up Supabase URL and Key in Settings.', 'error');
        return;
    }
    
    const googleBtn = document.getElementById('auth-google-btn');
    const submitBtn = document.getElementById('auth-submit-btn');
    
    const originalText = googleBtn.innerHTML;
    googleBtn.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    googleBtn.innerHTML = '<span class="spinner"></span> Connecting...';
    
    try {
        const client = getSupabaseClient();
        if (!client) {
            showToast('⚠️ Could not connect to Supabase. Please check your settings.', 'error');
            return;
        }
        
        // Build redirect URL: always land on dashboard.html after Google OAuth
        const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
        const redirectTo = window.location.origin + basePath + 'dashboard.html';

        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectTo,
                queryParams: {
                    prompt: 'select_account'
                }
            }
        });
        
        if (error) throw error;
    } catch (err) {
        showAuthAlert(err.message || 'Google Authentication failed. Please try again.', 'error');
        googleBtn.disabled = false;
        googleBtn.innerHTML = originalText;
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function handleSignOut() {
    const client = getSupabaseClient();
    if (client) {
        await client.auth.signOut();
    }
    localStorage.removeItem('offlineMode');
    localStorage.removeItem('userRole');
    localStorage.removeItem('lastLoggedInEmail');
    localStorage.removeItem('cachedProfile');
    localStorage.removeItem('demoUser');
    localStorage.removeItem('teacherDiary.timetable');
    if (window._ttChannel && client) { try { client.removeChannel(window._ttChannel); } catch (e) {} window._ttChannel = null; }
    window.location.href = 'index.html';
}

async function setupAuthListener() {
    if (isSupabaseConfigValid()) {
        const client = getSupabaseClient();
        if (client) {
            try {
                const { data: { session } } = await client.auth.getSession();
                initialSessionResolved = true;
                if (session) {
                    handleAuthState(session);
                } else {
                    localStorage.removeItem('cachedProfile');
                    localStorage.removeItem('userRole');
                    handleAuthState(null);
                }
            } catch (e) {
                initialSessionResolved = true;
                console.warn('Error fetching initial session:', e);
            }

            const configKey = window.App && window.App.school && window.App.school.schoolCode ? window.App.school.schoolCode : 'default';
            if (!authListenerBound || currentBoundClientConfig !== configKey) {
                client.auth.onAuthStateChange((event, session) => {
                    // Ignore null-session events that fire before the initial check resolves
                    // (Supabase v2 fires SIGNED_OUT briefly before INITIAL_SESSION)
                    if (!initialSessionResolved && !session) return;
                    handleAuthState(session);
                });
                authListenerBound = true;
                currentBoundClientConfig = configKey;
            }
            return;
        }
    }
    
    const overlay = document.getElementById('auth-overlay');
    // We do NOT auto-show the auth overlay now, so the user can see the landing page.
    const lastEmail = localStorage.getItem('lastLoggedInEmail');
    const emailInput = document.getElementById('auth-email');
    if (lastEmail && emailInput && !emailInput.value) {
        emailInput.value = lastEmail;
    }
}

async function upsertUserProfileAndFetchRole(session) {
    // Name kept for compatibility. It no longer writes: profiles are created server-side and the role can only
    // be changed by an admin (DB trigger guard_user_changes), so the browser only READS its profile.
    const cached = JSON.parse(localStorage.getItem('cachedProfile') || 'null');
    const fallbackRole = (cached && cached.role) || localStorage.getItem('userRole') || 'teacher';
    const client = getSupabaseClient();
    if (!client) return { role: fallbackRole };
    try {
        const res = await fetchActiveProfile(client, session.user.id);
        if (res.ok) return { role: res.profile.role, name: res.profile.name || '' };
        if (res.retryable) return { role: fallbackRole };      // network/DB hiccup: keep working with cached role
        return { blocked: true, message: res.message };
    } catch (err) {
        console.warn('Error loading user profile:', err);
        return { role: fallbackRole };
    }
}

async function handleAuthState(session) {
    const overlay = document.getElementById('auth-overlay');
    const userBanner = document.getElementById('headerUserBanner');
    const userEmail = document.getElementById('headerUserEmail');
    const userName = document.getElementById('headerUserName');
    const userRole = document.getElementById('headerUserRole');
    const userSchool = document.getElementById('headerUserSchool');

    const isLandingPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '';
    const isDashboard = window.location.pathname.endsWith('dashboard.html');

    if (session && session.user) {
        localStorage.removeItem('offlineMode');
        isBypassedAuth = false;
        
        if (isLandingPage) {
            window.location.href = 'dashboard.html';
            return;
        }
        if (overlay) overlay.classList.remove('active');
        if (userBanner) userBanner.classList.remove('hidden');
        
        const meta = session.user.user_metadata || {};
        let displayName = meta.full_name || meta.name || session.user.email;
        if (userName) userName.textContent = displayName;
        if (userEmail) userEmail.textContent = session.user.email;
        
        // Resolve avatar URL, falling back to a generated initials avatar
        let avatarUrl = meta.avatar_url || meta.picture || '';
        if (!avatarUrl && displayName) {
            avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4f46e5&color=fff&rounded=true&bold=true`;
        }
        const userAvatar = document.getElementById('headerUserAvatar');
        if (userAvatar) {
            userAvatar.src = avatarUrl;
            userAvatar.style.display = avatarUrl ? 'block' : 'none';
        }

        // Determine current saved role before remote fetch to avoid role flickering
        const cached = JSON.parse(localStorage.getItem('cachedProfile') || 'null');
        const currentSavedRole = (cached && cached.role) || localStorage.getItem('userRole') || window.currentUserRole || 'teacher';

        // Fetch role from DB safely without clobbering existing role on timeout
        let profileInfo = { role: currentSavedRole };
        try {
            profileInfo = await Promise.race([
                upsertUserProfileAndFetchRole(session),
                new Promise(resolve => setTimeout(() => resolve({ role: currentSavedRole }), 8000))
            ]);
        } catch (e) {
            console.warn('Profile fetch timeout/error, retaining role:', e);
        }
        if (profileInfo.blocked) {
            // Deactivated / unlinked / non-staff account: end the session and explain why.
            try { sessionStorage.setItem('authNotice', profileInfo.message); } catch (e) {}
            try { await getSupabaseClient().auth.signOut(); } catch (e) {}
            ['offlineMode','userRole','cachedProfile','demoUser'].forEach(k => localStorage.removeItem(k));
            window.location.href = 'index.html';
            return;
        }
        window.currentUserRole = profileInfo.role || currentSavedRole;
        localStorage.setItem('userRole', window.currentUserRole);
        if (profileInfo.name) {
            displayName = profileInfo.name;                       // teacher name comes from public.users
            if (userName) userName.textContent = displayName;
        }
        
        if (userRole) {
            const roleFormatted = window.currentUserRole.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            userRole.textContent = roleFormatted;
        }
        
        let schoolName = '';
        if (userSchool) {
            if (window.App && window.App.school && window.App.school.schoolName) {
                schoolName = window.App.school.schoolName;
                userSchool.textContent = schoolName;
                userSchool.style.display = '';
            } else {
                userSchool.style.display = 'none';
            }
        }

        // Persist profile data to localStorage so banner and role can be pre-filled on next refresh instantly
        localStorage.setItem('cachedProfile', JSON.stringify({
            name: displayName,
            email: session.user.email,
            avatar: avatarUrl,
            role: window.currentUserRole,
            school: schoolName
        }));
        
        if (meta.subject) {
            localStorage.setItem('userSubject', meta.subject);
        } else {
            const localSubj = localStorage.getItem('userSubject');
            if (!localSubj) localStorage.removeItem('userSubject');
        }
        
        // (Avatar is already set above — no duplicate block needed)
        
        if (session.user.email) {
            localStorage.setItem('lastLoggedInEmail', session.user.email);
        }

        // Clean up the URL hash fragment to prevent token leakage and keep URL clean
        if (window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('type=recovery'))) {
            history.replaceState(null, document.title, window.location.pathname + window.location.search);
        }

        // Apply Role-based routing (hide/show tabs)
        applyRoleBasedUI(window.currentUserRole);
        
        // Initialize Notifications
        if (window.subscribeToNotifications) {
            window.subscribeToNotifications();
        }
        // Live timetable updates (one subscription per session)
        if (window.subscribeTimetableChanges) {
            window.subscribeTimetableChanges();
        }

        // Auto-select 'daily' dashboard tab when signed in
        const dailyTabButton = document.querySelector('[data-tab="daily"]');
        if (dailyTabButton && !dailyTabButton.classList.contains('active')) {
            dailyTabButton.click();
        }
    } else {
        if (isDashboard && !isBypassedAuth) {
            window.location.href = 'index.html';
            return;
        }

        try {
            const notice = sessionStorage.getItem('authNotice');
            if (notice) {
                sessionStorage.removeItem('authNotice');
                if (typeof showToast === 'function') showToast(notice, 'error');
            }
        } catch (e) {}
        localStorage.removeItem('userSubject');
        if (userBanner) userBanner.classList.add('hidden');
        if (userEmail) userEmail.textContent = '';
        
        const avatarEl = document.getElementById('headerUserAvatar');
        if (avatarEl) {
            avatarEl.src = '';
            avatarEl.style.display = 'none';
        }
        
        if (!isBypassedAuth) {
            // Do not automatically show auth overlay, let the landing page button do it
            const lastEmail = localStorage.getItem('lastLoggedInEmail');
            const emailInput = document.getElementById('auth-email');
            if (lastEmail && emailInput && !emailInput.value) {
                emailInput.value = lastEmail;
            }
        } else {
            if (overlay) overlay.classList.remove('active');
        }
    }
}

// Ensure globally accessible
window.handleGoogleSignIn = handleGoogleSignIn;
window.handleSignOut = handleSignOut;
window.switchAuthTab = switchAuthTab;
window.handleAuthSubmit = handleAuthSubmit;
