// ================================================================
//  INTRO.JS ONBOARDING TOUR  (v3 — fixed steps 3 & 5 visibility)
// ================================================================

function switchTabProgrammatically(tabName) {
    const btn = document.querySelector(`.tab-nav button[data-tab="${tabName}"]`);
    if (btn) {
        btn.click();
    }
}

function startIntroTour() {
    if (typeof introJs !== 'function') {
        showToast('❌ Intro.js library not loaded. Make sure you are online.', 'error');
        return;
    }

    // Make sure we start on the Daily tab
    switchTabProgrammatically('daily');

    // Give the tab a moment to render, then launch
    setTimeout(_launchTour, 300);
}

function _launchTour() {
    document.body.classList.add('tour-active');

    // ---- Build steps dynamically based on what's actually visible ----
    const steps = [];

    // Step 1: Welcome (floating — always visible)
    steps.push({
        title: "👋 Welcome!",
        intro: "Welcome to your <strong>Teacher's Daily Planner</strong>. Let's take a quick tour of the key features."
    });

    // Step 2: Tab navigation
    _addStep(steps, '#tabNav', {
        title: "Navigation Tabs",
        intro: "Switch between <strong>Daily Entry</strong>, <strong>View Activities</strong>, <strong>Notifications</strong>, and <strong>Settings</strong>.",
        position: 'bottom'
    });

    // Step 3: Daily entry card — target the header row, not the full card
    // The full .card is too tall and has stacking context issues.
    // Use the .flex-between header row inside the card as the target instead.
    _addStep(steps, '#tab-daily .flex-between', {
        title: "📅 Daily Entry Form",
        intro: "Fill your classwork and homework here. Pick a date and enter activities for each period below.",
        position: 'bottom'
    }, {
        title: "📅 Daily Entry Form",
        intro: "Fill your classwork and homework here. Pick a date and enter activities for each period. This is the main area of your daily planner."
    });

    // Step 4: Copy previous button
    _addStep(steps, '#copyPrevBtn', {
        title: "Copy Previous Day",
        intro: "Save time by duplicating your entries from yesterday.",
        position: 'bottom'
    });

    // Step 5: Period cards — dynamically generated, so often empty.
    // Target the first .period-card inside if it exists, otherwise fallback.
    _addStep(steps, '#periodCards .period-card', {
        title: "Daily Activities Cards",
        intro: "Enter details for each period. Select a class (e.g. 10) to load that class's custom curriculum topics.",
        position: 'top'
    }, {
        title: "📋 Period Cards",
        intro: "Your <strong>period cards</strong> appear here after the page loads. Each card lets you enter the class, subject, classwork, and homework for one period."
    });

    // Step 6: Classwork textarea (dynamically generated — often absent)
    _addStep(steps, '.daily-work', {
        title: "✨ Auto-Complete Shortcuts",
        intro: "Type <strong>#</strong> in the Classwork or Homework box to search and insert chapter topics instantly. No typing required!",
        position: 'bottom'
    }, {
        title: "✨ Auto-Complete Shortcuts",
        intro: "Type <strong>#</strong> in any <strong>Classwork</strong> or <strong>Homework</strong> text box to search and insert chapter topics instantly. No typing required!"
    });

    // Step 7: Save button
    _addStep(steps, '#saveDailyBtn', {
        title: "Save Your Progress",
        intro: "Click <strong>Save</strong> to store your diary entries locally in the browser and sync them to your Supabase database.",
        position: 'top'
    });

    // Step 8: Submit for Approval (hidden by default)
    _addStep(steps, '#submitForApprovalBtn', {
        title: "Submit for Approval",
        intro: "Once your diary is complete, submit it to the principal for review and approval.",
        position: 'top'
    }, {
        title: "📤 Submit for Approval",
        intro: "Once your diary is complete, a <strong>Submit for Approval</strong> button will appear. Use it to send your diary to the principal for review."
    });

    // Step 9: Curriculum status banner (hidden by default)
    _addStep(steps, '#curriculum-status-banner', {
        title: "Curriculum Status Banner",
        intro: "Displays whether the static curriculum topics are loaded and saved locally for your active class and subject.",
        position: 'bottom'
    }, {
        title: "📚 Curriculum Status",
        intro: "A <strong>Curriculum Status Banner</strong> appears at the top of Daily Entry when curriculum topics are loading or have an error."
    });

    // Step 10: Notifications tab button (always in the nav)
    _addStep(steps, '#notificationsTabBtn', {
        title: "Notifications",
        intro: "Check here for alerts about diary approvals, rejection notes from the principal, and system updates.",
        position: 'bottom'
    });

    // Step 11: Principal Dashboard tab (hidden for non-principals)
    _addStep(steps, 'button[data-tab="principal"]', {
        title: "Principal Dashboard",
        intro: "If you are a Principal, use this tab to review and approve teacher diaries, view KPIs, and track analytics.",
        position: 'bottom'
    }, {
        title: "📊 Principal Dashboard",
        intro: "If you are a <strong>Principal</strong>, a dedicated dashboard tab will appear to review and approve teacher diaries, view KPIs, and track analytics."
    });

    // Step 12: Settings tab
    _addStep(steps, 'button[data-tab="settings"]', {
        title: "Settings Panel",
        intro: "Configure your Supabase URL, API Keys, and custom Board/Class/Subject under settings to unlock advanced features.",
        position: 'bottom'
    });

    // ---- Create and start the tour ----
    const tour = introJs();
    tour.setOptions({
        steps: steps,
        showProgress: true,
        showBullets: false,
        disableInteraction: false,
        exitOnOverlayClick: false,
        scrollToElement: true,
        scrollPadding: 80
    });

    tour.oncomplete(function () {
        _cleanupTour();
        showToast('🎉 Tour completed! You are ready to go.', 'success');
    });

    tour.onexit(function () {
        _cleanupTour();
    });

    tour.start();
}

/**
 * Add a step to the steps array.
 * If the element is visible, attach it. Otherwise use the floating fallback.
 *
 * @param {Array} steps - The steps array to push to
 * @param {string} selector - CSS selector for the target element
 * @param {Object} stepConfig - The intro.js step config (with element, title, intro, position)
 * @param {Object} [fallback] - Optional floating fallback step (title + intro only, no element)
 */
function _addStep(steps, selector, stepConfig, fallback) {
    const el = document.querySelector(selector);

    if (el && _isHighlightable(el)) {
        steps.push({
            element: el,
            title: stepConfig.title,
            intro: stepConfig.intro,
            position: stepConfig.position || 'bottom'
        });
    } else if (fallback) {
        // Show a floating tooltip instead — user still learns about the feature
        steps.push({
            title: fallback.title,
            intro: fallback.intro
        });
    }
    // If no fallback provided and element is not visible, skip entirely
}

/**
 * Check if a DOM element can be properly highlighted by intro.js:
 *  - Must not be display:none (inline or computed)
 *  - Must not have the .hidden utility class
 *  - Must have non-zero width AND height
 */
function _isHighlightable(el) {
    // Check inline display:none
    if (el.style.display === 'none') return false;

    // Check .hidden utility class (uses display:none !important)
    if (el.classList.contains('hidden')) return false;

    // Check computed style
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;

    // Must have actual dimensions — both width AND height must be > 0
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    return true;
}

function _cleanupTour() {
    document.body.classList.remove('tour-active');
    switchTabProgrammatically('daily');
}

// Attach to start tour button click listener on load
document.addEventListener('DOMContentLoaded', () => {
    const startTourBtn = document.getElementById('startTourBtn');
    if (startTourBtn) {
        startTourBtn.addEventListener('click', startIntroTour);
    }
});
