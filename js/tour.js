// ================================================================
//  INTRO.JS ONBOARDING TOUR
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

    // Add tour-active class to body to bypass animation stacking context issues
    document.body.classList.add('tour-active');

    const tour = introJs();
    tour.setOptions({
        steps: [
            {
                title: "👋 Welcome!",
                intro: "Welcome to your <strong>Teacher's Daily Planner</strong>. Let's take a quick tour of the key features."
            },
            {
                element: '.tab-nav',
                title: "Navigation Tabs",
                intro: "Switch between <strong>Daily Entry</strong> (for today's entry), <strong>View Activities</strong> (to search past history), and <strong>Settings</strong> (for configuration).",
                position: 'bottom'
            },
            {
                element: '#tab-daily .card',
                title: "Daily Entry Form",
                intro: "Fill your classwork and homework here. You can also pick a different date or copy your data from the previous day.",
                position: 'bottom'
            },
            {
                element: '.period-table-wrap',
                title: "Daily Activities Grid",
                intro: "Enter details for each period. Select a class (e.g. 10) to load that class's custom curriculum topics.",
                position: 'top'
            },
            {
                element: '#tourClassworkWrap',
                title: "✨ Auto-Complete Shortcuts",
                intro: "Type <strong>#</strong> in the Classwork or Homework box to search and insert chapter topics instantly. No typing required!",
                position: 'bottom'
            },
            {
                element: '#saveDailyBtn',
                title: "Save Your Progress",
                intro: "Click <strong>Save</strong> to store your diary entries locally in the browser and sync them to your Supabase database.",
                position: 'top'
            },
            {
                element: '#curriculum-status-banner',
                title: "Curriculum Status Banner",
                intro: "Displays whether the static curriculum topics are loaded and saved locally for your active class and subject.",
                position: 'bottom'
            },
            {
                element: 'button[data-tab="settings"]',
                title: "Settings Panel",
                intro: "Configure your Supabase URL, API Keys, and custom Board/Class/Subject under settings to unlock advanced features.",
                position: 'bottom'
            }
        ],
        showProgress: true,
        showBullets: false,
        disableInteraction: false,
        exitOnOverlayClick: false
    });

    // Handle tab switching automatically during tour steps!
    tour.onbeforechange(function(targetElement) {
        if (!targetElement) return;
        
        // Switch tabs dynamically depending on where the target element resides
        if (targetElement.closest('#tab-settings') || targetElement.getAttribute('data-tab') === 'settings') {
            switchTabProgrammatically('settings');
        } else if (targetElement.closest('#tab-daily') || targetElement.id === 'curriculum-status-banner') {
            switchTabProgrammatically('daily');
        }
    });

    // Make sure we switch back to daily entry when tour is completed or exited
    tour.oncomplete(function() {
        document.body.classList.remove('tour-active');
        switchTabProgrammatically('daily');
        showToast('🎉 Tour completed! You are ready to go.', 'success');
    });
    
    tour.onexit(function() {
        document.body.classList.remove('tour-active');
        switchTabProgrammatically('daily');
    });

    tour.start();
}

// Attach to start tour button click listener on load
document.addEventListener('DOMContentLoaded', () => {
    const startTourBtn = document.getElementById('startTourBtn');
    if (startTourBtn) {
        startTourBtn.addEventListener('click', startIntroTour);
    }
});
