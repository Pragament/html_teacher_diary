// ================================================================
//  AUTH SERVICE (Supabase only - no local storage)
// ================================================================

function isSupabaseConfigValid() {
    if (!window.ENV) return false;
    const url = window.ENV.SUPABASE_URL || '';
    const key = window.ENV.SUPABASE_KEY || '';
    return url.includes('.supabase.co') && (key.length > 30);
}

// ================================================================
//  AUTH UI LOGIC
// ================================================================
let isBypassedAuth = localStorage.getItem('offlineMode') === 'true';
let currentAuthTab = 'login';
let authListenerBound = false;
let currentBoundClientConfig = '';

function switchAuthTab(tab) {
    currentAuthTab = tab;
    const loginBtn = document.getElementById('tab-login-btn');
    const signupBtn = document.getElementById('tab-signup-btn');
    const submitBtn = document.getElementById('auth-submit-btn');
    const subtitle = document.querySelector('.auth-subtitle');
    const nameGroup = document.getElementById('register-name-group');
    const subjectGroup = document.getElementById('register-subject-group');
    const nameInput = document.getElementById('auth-name');
    
    if (tab === 'login') {
        loginBtn.classList.add('active');
        signupBtn.classList.remove('active');
        submitBtn.textContent = 'Sign In';
        subtitle.textContent = 'Sign in to your Teacher Planner account';
        if (nameGroup) nameGroup.style.display = 'none';
        if (subjectGroup) subjectGroup.style.display = 'none';
        if (nameInput) nameInput.removeAttribute('required');
    } else {
        loginBtn.classList.remove('active');
        signupBtn.classList.add('active');
        submitBtn.textContent = 'Register Account';
        subtitle.textContent = 'Create your Teacher Planner account';
        if (nameGroup) nameGroup.style.display = 'block';
        if (subjectGroup) subjectGroup.style.display = 'block';
        if (nameInput) nameInput.setAttribute('required', '');
    }
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('auth-submit-btn');
    
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Working...';
    
    try {
        if (!isSupabaseConfigValid()) {
            showToast('⚠️ Supabase is not configured. Please set up Supabase URL and Key in Settings.', 'error');
            return;
        }

        const client = getSupabaseClient();
        if (!client) {
            showToast('⚠️ Could not connect to Supabase. Please check your settings.', 'error');
            return;
        }
        
        if (currentAuthTab === 'login') {
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            handleAuthState(data.session);
            localStorage.setItem('lastLoggedInEmail', email);
            showToast('Welcome back! Successfully signed in.', 'success');
        } else {
            const name = document.getElementById('auth-name').value.trim();
            const subject = document.getElementById('auth-subject').value.trim();
            
            const signUpOptions = {
                email,
                password,
                options: {
                    data: {
                        full_name: name || '',
                        subject: subject || ''
                    }
                }
            };
            const { data, error } = await client.auth.signUp(signUpOptions);
            if (error) throw error;
            if (data.session) {
                handleAuthState(data.session);
                showToast('🎉 Registration successful! Welcome to Teacher Planner.', 'success');
            } else {
                showToast('📧 Verification email sent! Please check your inbox and verify your email before logging in.', 'info', 8000);
                switchAuthTab('login');
            }
        }
    } catch (err) {
        showToast(err.message || 'Authentication failed. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
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
        
        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname,
                queryParams: {
                    prompt: 'select_account'
                }
            }
        });
        
        if (error) throw error;
    } catch (err) {
        showToast(err.message || 'Google Authentication failed. Please try again.', 'error');
        googleBtn.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
        googleBtn.innerHTML = originalText;
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
    window.location.href = 'index.html';
}

function bypassAuthToLocal() {
    localStorage.setItem('offlineMode', 'true');
    isBypassedAuth = true;
    window.location.href = 'dashboard.html';
}

async function setupAuthListener() {
    if (isSupabaseConfigValid()) {
        const client = getSupabaseClient();
        if (client) {
            try {
                const { data: { session } } = await client.auth.getSession();
                if (session) {
                    handleAuthState(session);
                }
            } catch (e) {
                console.warn('Error fetching initial session:', e);
            }

            const settings = getSettings();
            const configKey = (settings.supabaseUrl || '') + '|' + (settings.supabaseKey || '');
            if (!authListenerBound || currentBoundClientConfig !== configKey) {
                client.auth.onAuthStateChange((event, session) => {
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
    const client = getSupabaseClient();
    if (!client) return { role: 'teacher', school_name: '' };
    
    const meta = session.user.user_metadata || {};
    const email = session.user.email;
    const name = meta.full_name || '';
    const avatarUrl = meta.avatar_url || meta.picture || '';

    try {
        // 1. Fetch existing profile to check role
        const { data: profile, error: fetchErr } = await client
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();
            
        if (fetchErr) {
            console.warn('GET /users error (ignoring and proceeding with upsert):', fetchErr);
        }
            
        if (!profile) {
            // 2. If it doesn't exist (or fetch failed), upsert the initial profile
            await client.from('users').upsert({
                id: session.user.id,
                email: email,
                name: name,
                avatar_url: avatarUrl,
                role: 'teacher' // default role
            }, { onConflict: 'id' });
            return { role: 'teacher' };
        } else {
            // Update name, avatar
            await client.from('users').upsert({
                id: session.user.id,
                email: email,
                name: name,
                avatar_url: avatarUrl,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
            
            return {
                role: profile.role || 'teacher'
            };
        }
    } catch (err) {
        console.warn('Error upserting user profile:', err);
        return { role: 'teacher' };
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
        let displayName = meta.full_name || session.user.email;
        if (userName) userName.textContent = displayName;
        if (userEmail) userEmail.textContent = session.user.email;
        
        // Fetch role from DB
        const profileInfo = await upsertUserProfileAndFetchRole(session);
        window.currentUserRole = profileInfo.role;
        
        if (userRole) {
            const roleFormatted = window.currentUserRole.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            userRole.textContent = roleFormatted;
        }
        if (userSchool) {
            userSchool.style.display = 'none';
        }
        
        if (meta.subject) {
            localStorage.setItem('userSubject', meta.subject);
        } else {
            const localSubj = localStorage.getItem('userSubject');
            if (!localSubj) localStorage.removeItem('userSubject');
        }
        
        // Render Google Profile Avatar if available
        const avatarEl = document.getElementById('headerUserAvatar');
        if (avatarEl) {
            const avatarUrl = meta.avatar_url || meta.picture || '';
            if (avatarUrl) {
                avatarEl.src = avatarUrl;
                avatarEl.style.display = 'block';
            } else {
                avatarEl.src = '';
                avatarEl.style.display = 'none';
            }
        }
        
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

        localStorage.removeItem('userSubject');
        if (userBanner) userBanner.classList.add('hidden');
        if (userEmail) userEmail.textContent = '';
        
        const avatarEl = document.getElementById('headerUserAvatar');
        if (avatarEl) {
            avatarEl.src = '';
            avatarEl.style.display = 'none';
        }
        
        const settings = getSettings();
        if (settings.supabaseUrl && settings.supabaseKey && !isBypassedAuth) {
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
window.bypassAuthToLocal = bypassAuthToLocal;
