// ================================================================
//  LOCAL AUTH SERVICE (works without Supabase)
// ================================================================
const LOCAL_AUTH_KEY = 'teacherPlanner_localUsers';
const LOCAL_SESSION_KEY = 'teacherPlanner_localSession';

async function hashPassword(password) {
    const salted = password + '_teacher_planner_salt_2024';
    if (window.crypto && window.crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(salted);
        try {
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.warn('crypto.subtle.digest failed, using fallback hash:', e);
        }
    }
    // Fallback: simple deterministic 128-bit hash for offline local usage
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x30393039, h4 = 0x21212121;
    for (let i = 0; i < salted.length; i++) {
        const ch = salted.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
        h3 = Math.imul(h3 ^ ch, 3432918353);
        h4 = Math.imul(h4 ^ ch, 1171053229);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= h1 >>> 13;
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= h2 >>> 13;
    h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507);
    h3 ^= h3 >>> 13;
    h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507);
    h4 ^= h4 >>> 13;
    
    const toHex = (num) => (num >>> 0).toString(16).padStart(8, '0');
    return toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4);
}

function getLocalUsers() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_AUTH_KEY) || '{}');
    } catch { return {}; }
}

function saveLocalUsers(users) {
    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(users));
}

function getLocalSession() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_SESSION_KEY) || 'null');
    } catch { return null; }
}

function setLocalSession(session) {
    if (session) {
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
    } else {
        localStorage.removeItem(LOCAL_SESSION_KEY);
    }
}

async function localRegister(email, password, name, subject) {
    const users = getLocalUsers();
    if (users[email]) {
        return { error: 'An account with this email already exists. Please sign in instead.' };
    }
    if (password.length < 6) {
        return { error: 'Password must be at least 6 characters.' };
    }
    const hashedPw = await hashPassword(password);
    users[email] = {
        email,
        password: hashedPw,
        full_name: name || '',
        subject: subject || '',
        created_at: new Date().toISOString(),
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    };
    saveLocalUsers(users);
    const session = {
        user: {
            id: users[email].id,
            email: email,
            user_metadata: {
                full_name: name || '',
                subject: subject || ''
            }
        }
    };
    setLocalSession(session);
    return { data: { session }, error: null };
}

async function localLogin(email, password) {
    const users = getLocalUsers();
    const user = users[email];
    if (!user) {
        return { error: 'No account found with this email. Please register first.' };
    }
    const hashedPw = await hashPassword(password);
    if (user.password !== hashedPw) {
        return { error: 'Incorrect password. Please try again.' };
    }
    const session = {
        user: {
            id: user.id,
            email: email,
            user_metadata: {
                full_name: user.full_name || '',
                subject: user.subject || ''
            }
        }
    };
    setLocalSession(session);
    return { data: { session }, error: null };
}

function localSignOut() {
    setLocalSession(null);
}

function isSupabaseConfigValid() {
    const settings = getSettings();
    const url = settings.supabaseUrl || '';
    const key = settings.supabaseKey || '';
    return url.includes('.supabase.co') && key.startsWith('eyJ') && key.length > 100;
}

// ================================================================
//  AUTH UI LOGIC
// ================================================================
let isBypassedAuth = false;
let currentAuthTab = 'login';
let authListenerBound = false;

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
        const useSupabase = isSupabaseConfigValid();
        
        if (currentAuthTab === 'login') {
            if (useSupabase) {
                try {
                    const client = getSupabaseClient();
                    if (client) {
                        const { error } = await client.auth.signInWithPassword({ email, password });
                        if (error) throw error;
                        showToast('Welcome back! Successfully signed in.', 'success');
                        return;
                    }
                } catch (supaErr) {
                    const isNetworkErr = supaErr.message && (
                        supaErr.message.includes('fetch') || 
                        supaErr.message.includes('network') || 
                        supaErr.message.includes('Failed')
                    );
                    const isRateLimit = supaErr.message && (
                        supaErr.message.includes('rate limit') || 
                        supaErr.message.includes('exceeded')
                    );
                    
                    if (isNetworkErr || isRateLimit) {
                        console.warn('Supabase login rate-limited or unreachable, falling back to local auth:', supaErr.message);
                        showToast(`⚠️ Supabase error: "${supaErr.message}". Logging you in locally instead.`, 'warning', 5000);
                    } else {
                        throw supaErr;
                    }
                }
            }
            const result = await localLogin(email, password);
            if (result.error) {
                showToast(result.error, 'error');
                return;
            }
            handleAuthState(result.data.session);
            localStorage.setItem('lastLoggedInEmail', email);
            showToast('Welcome back! Signed in locally.', 'success');
        } else {
            const name = document.getElementById('auth-name').value.trim();
            const subject = document.getElementById('auth-subject').value.trim();
            
            if (useSupabase) {
                try {
                    const client = getSupabaseClient();
                    if (client) {
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
                            showToast('Registration successful! Welcome.', 'success');
                        } else {
                            // Fallback to local session so they can use the app instantly without email verification
                            const localResult = await localRegister(email, password, name, subject);
                            if (localResult.error) {
                                const localLoginResult = await localLogin(email, password);
                                if (!localLoginResult.error) {
                                    handleAuthState(localLoginResult.data.session);
                                }
                            } else {
                                handleAuthState(localResult.data.session);
                            }
                            showToast('🎉 Registration successful! Welcome to Teacher Planner.', 'success');
                        }
                        return;
                    }
                } catch (supaErr) {
                    const isNetworkErr = supaErr.message && (
                        supaErr.message.includes('fetch') || 
                        supaErr.message.includes('network') || 
                        supaErr.message.includes('Failed')
                    );
                    const isRateLimit = supaErr.message && (
                        supaErr.message.includes('rate limit') || 
                        supaErr.message.includes('exceeded')
                    );
                    
                    if (isNetworkErr || isRateLimit) {
                        console.warn('Supabase signup rate-limited or unreachable, falling back to local auth:', supaErr.message);
                        showToast(`⚠️ Supabase error: "${supaErr.message}". Registering you locally instead.`, 'warning', 5000);
                    } else {
                        throw supaErr;
                    }
                }
            }
            const result = await localRegister(email, password, name, subject);
            if (result.error) {
                showToast(result.error, 'error');
                return;
            }
            handleAuthState(result.data.session);
            localStorage.setItem('lastLoggedInEmail', email);
            showToast('🎉 Registration successful! Welcome to Teacher Planner.', 'success');
        }
    } catch (err) {
        showToast(err.message || 'Authentication failed. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function handleSignOut() {
    localSignOut();
    
    const client = getSupabaseClient();
    if (client) {
        try {
            await client.auth.signOut();
        } catch (e) {
            console.warn('Supabase sign out failed:', e.message);
        }
    }
    
    handleAuthState(null);
    showToast('Successfully signed out.', 'info');
}

function bypassAuthToLocal() {
    isBypassedAuth = true;
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.remove('active');
    showToast('Using planner in Local Offline Mode. Data will not sync to Supabase.', 'info');
}

function setupAuthListener() {
    const localSession = getLocalSession();
    if (localSession && localSession.user) {
        handleAuthState(localSession);
        return;
    }
    
    if (isSupabaseConfigValid()) {
        const client = getSupabaseClient();
        if (client) {
            if (!authListenerBound) {
                client.auth.onAuthStateChange((event, session) => {
                    handleAuthState(session);
                });
                authListenerBound = true;
            } else {
                client.auth.getSession().then(({ data: { session } }) => {
                    handleAuthState(session);
                });
            }
            return;
        }
    }
    
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.add('active');
    const lastEmail = localStorage.getItem('lastLoggedInEmail');
    const emailInput = document.getElementById('auth-email');
    if (lastEmail && emailInput && !emailInput.value) {
        emailInput.value = lastEmail;
    }
}

function handleAuthState(session) {
    const overlay = document.getElementById('auth-overlay');
    const userBanner = document.getElementById('headerUserBanner');
    const userEmail = document.getElementById('headerUserEmail');

    if (session && session.user) {
        overlay.classList.remove('active');
        userBanner.classList.remove('hidden');
        
        const meta = session.user.user_metadata || {};
        let displayName = meta.full_name || session.user.email;
        if (meta.full_name && meta.subject) {
            displayName += ` (${meta.subject})`;
        }
        
        if (meta.subject) {
            localStorage.setItem('userSubject', meta.subject);
        } else {
            localStorage.removeItem('userSubject');
        }
        
        userEmail.textContent = displayName;
        userEmail.title = session.user.email;
        if (session.user.email) {
            localStorage.setItem('lastLoggedInEmail', session.user.email);
        }
    } else {
        localStorage.removeItem('userSubject');
        userBanner.classList.add('hidden');
        userEmail.textContent = '';
        
        const settings = getSettings();
        if (settings.supabaseUrl && settings.supabaseKey && !isBypassedAuth) {
            overlay.classList.add('active');
            
            const lastEmail = localStorage.getItem('lastLoggedInEmail');
            const emailInput = document.getElementById('auth-email');
            if (lastEmail && emailInput && !emailInput.value) {
                emailInput.value = lastEmail;
            }
        } else {
            overlay.classList.remove('active');
        }
    }
}
