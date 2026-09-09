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

    // Ensure we are in "cards" (expanded) view so textareas like .daily-work are visible
    if (typeof switchViewMode === 'function') {
        switchViewMode('cards');
    } else if (typeof window.switchViewMode === 'function') {
        window.switchViewMode('cards');
    }

    const tour = introJs();
    
    const steps = [
        {
            title: "👋 Welcome!",
            intro: "Welcome to your <strong>Teacher's Daily Planner</strong>. Let's take a quick tour of the key features."
        },
        {
            element: '.tab-nav',
            title: "Navigation Tabs",
            intro: "Switch between <strong>Daily Entry</strong>, <strong>View Activities</strong>, <strong>Notifications</strong>, and <strong>Settings</strong>.",
            position: 'bottom'
        },
        {
            element: '#tab-daily .flex-between',
            title: "Daily Entry Form",
            intro: "Fill your classwork and homework here. You can also pick a different date or copy your data from the previous day.",
            position: 'bottom'
        },
        {
            element: '#copyPrevBtn',
            title: "Copy Previous Day",
            intro: "Save time by duplicating your entries from yesterday.",
            position: 'bottom'
        },
        {
            element: '#period-card-1',
            title: "Daily Activities Cards",
            intro: "Enter details for each period. Select a class (e.g. 10) to load that class's custom curriculum topics.",
            position: 'top'
        },
        {
            element: '#period-card-1 .daily-work',
            title: "✨ Auto-Complete Shortcuts",
            intro: "Type <strong>#</strong> in the Classwork or Homework box to search and insert chapter topics instantly. No typing required!",
            position: 'right'
        },
        {
            element: '#saveDailyBtn',
            title: "Save Your Progress",
            intro: "Click <strong>Save</strong> to store your diary entries locally in the browser and sync them to your Supabase database.",
            position: 'top'
        },
        {
            element: '#notificationsTabBtn',
            title: "Notifications",
            intro: "Check here for alerts about diary approvals, rejection notes from the principal, and system updates.",
            position: 'bottom'
        }
    ];

    const submitBtn = document.getElementById('submitForApprovalBtn');
    if (submitBtn && submitBtn.style.display !== 'none') {
        // Insert right before the Notifications step (which is the last one in the base array)
        steps.splice(steps.length - 1, 0, {
            element: '#submitForApprovalBtn',
            title: "Submit for Approval",
            intro: "Once your diary is complete, submit it to the principal for review and approval.",
            position: 'top'
        });
    }

    const principalBtn = document.querySelector('button[data-tab="principal"]');
    if (principalBtn && principalBtn.style.display !== 'none') {
        steps.push(
            {
                element: 'button[data-tab="principal"]',
                title: "Principal Dashboard",
                intro: "If you are a Principal, use this tab to review and approve teacher diaries, view KPIs, and track analytics.",
                position: 'bottom'
            },
            {
                element: '.principal-kpis',
                title: "Analytics Overview",
                intro: "Get a quick birds-eye view of total teachers, pending diaries, and missing entries at a glance.",
                position: 'bottom'
            },
            {
                element: '.principal-filters',
                title: "Search & Filter",
                intro: "Easily filter submissions by Teacher, Class, Subject, or Date to find exactly what you need.",
                position: 'bottom'
            }
        );
    }

    steps.push(
        {
            element: 'button[data-tab="settings"]',
            title: "Settings Panel",
            intro: "Configure your app experience here.",
            position: 'bottom'
        },
        {
            element: '#schoolSettingsGroup',
            title: "Connected School",
            intro: "View the school database you are connected to. You can change schools here if you teach at multiple campuses.",
            position: 'bottom'
        },
        {
            element: '#settingsSavePeriods',
            title: "Schedule Configuration",
            intro: "Change the number of periods in your daily schedule.",
            position: 'bottom'
        },
        {
            element: '#settingsSaveCurriculumConfig',
            title: "Dynamic Curriculum",
            intro: "Configure your Board, Class, and Subject to dynamically fetch topics directly from your school's database.",
            position: 'top'
        }
    );

    tour.setOptions({
        steps: steps,
        showProgress: true,
        showBullets: false,
        disableInteraction: false,
        exitOnOverlayClick: false
    });

    // Handle tab switching automatically during tour steps!
    tour.onbeforechange(function(targetElement) {
        if (!targetElement) return;
        
        // Switch tabs dynamically depending on where the target element resides
        if (targetElement.closest('#tab-settings') || targetElement.getAttribute('data-tab') === 'settings'
            || targetElement.id === 'schoolSettingsGroup' || targetElement.id === 'settingsSavePeriods' || targetElement.id === 'settingsSaveCurriculumConfig') {
            switchTabProgrammatically('settings');
        } else if (targetElement.closest('#tab-principal') || targetElement.getAttribute('data-tab') === 'principal'
            || targetElement.classList.contains('principal-kpis') || targetElement.classList.contains('principal-filters')) {
            switchTabProgrammatically('principal');
        } else if (targetElement.closest('#tab-daily')
            || targetElement.classList.contains('daily-work')
            || targetElement.classList.contains('period-card')
            || targetElement.id === 'period-card-1'
            || ['curriculum-status-banner','saveDailyBtn','submitForApprovalBtn','copyPrevBtn'].includes(targetElement.id)) {
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
