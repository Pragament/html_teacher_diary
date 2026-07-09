// ================================================================
//  TAB SWITCHING
// ================================================================
function setupTabs() {
    document.querySelectorAll('.tab-nav button').forEach(btn => {
        btn.addEventListener('click', function () {
            const tab = this.dataset.tab;
            document.querySelectorAll('.tab-nav button').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.getElementById('tab-' + tab).classList.add('active');
            // render content
            if (tab === 'daily') renderDailyTab();
            if (tab === 'view') renderViewTab();
            if (tab === 'settings') loadSettingsUI();
        });
    });
}

// ================================================================
//  INIT
// ================================================================
function init() {
    // header date
    document.getElementById('headerDate').textContent = '📅 ' + formatDate(getTodayStr());

    // tabs
    setupTabs();

    // daily
    document.getElementById('dailyDate').addEventListener('change', renderDailyTab);
    document.getElementById('saveDailyBtn').addEventListener('click', saveDaily);
    document.getElementById('resetDailyBtn').addEventListener('click', resetDaily);
    document.getElementById('copyPrevBtn').addEventListener('click', copyPreviousDay);

    // view
    document.getElementById('viewSearch').addEventListener('input', renderViewTab);
    document.getElementById('viewDateFrom').addEventListener('change', renderViewTab);
    document.getElementById('viewDateTo').addEventListener('change', renderViewTab);
    document.getElementById('viewSort').addEventListener('change', renderViewTab);

    // settings
    document.getElementById('settingsSavePeriods').addEventListener('click', savePeriodsSetting);
    document.getElementById('settingsSaveSubject').addEventListener('click', saveSubjectSetting);
    document.getElementById('settingsSaveCurriculumConfig').addEventListener('click', saveCurriculumConfigSetting);
    const clearCacheBtn = document.getElementById('settingsClearCacheBtn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', () => {
            clearApiCache();
            showToast('🧹 API Cache cleared!', 'success');
        });
    }
    document.getElementById('settingsRefreshCurriculum').addEventListener('click', () => {
        loadCurriculumCSV(true);
        showToast('Refreshing curriculum tags...', 'info');
    });
    const retryBtn = document.getElementById('curriculum-retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => loadCurriculumCSV(true));
    }

    const seedCurriculumBtn = document.getElementById('settingsSeedCurriculum');
    if (seedCurriculumBtn) {
        seedCurriculumBtn.addEventListener('click', seedDatabaseCurriculum);
    }
    document.getElementById('settingsSupabaseTest').addEventListener('click', testSupabase);
    document.getElementById('settingsSupabasePush').addEventListener('click', doPushSupabase);
    document.getElementById('settingsSupabasePull').addEventListener('click', doPullSupabase);

    const fetchConfigBtn = document.getElementById('settingsSupabaseFetchConfig');
    if (fetchConfigBtn) {
        fetchConfigBtn.addEventListener('click', showFetchConfigModal);
    }
    const cancelFetchConfigBtn = document.getElementById('cancelFetchConfigBtn');
    if (cancelFetchConfigBtn) {
        cancelFetchConfigBtn.addEventListener('click', hideFetchConfigModal);
    }
    const submitFetchConfigBtn = document.getElementById('submitFetchConfigBtn');
    if (submitFetchConfigBtn) {
        submitFetchConfigBtn.addEventListener('click', handleFetchConfigSubmit);
    }

    document.getElementById('settingsExportCSV').addEventListener('click', exportCSV);
    document.getElementById('settingsImportCSV').addEventListener('click', () => document.getElementById('csvFileInput').click());
    document.getElementById('csvFileInput').addEventListener('change', function (e) {
        if (this.files && this.files[0]) {
            importCSV(this.files[0]);
            this.value = '';
        }
    });
    document.getElementById('settingsClearAll').addEventListener('click', clearAllData);

    // save supabase settings when fields change (blur)
    ['settingsSupabaseUrl', 'settingsSupabaseKey', 'settingsSupabaseTable'].forEach(id => {
        document.getElementById(id).addEventListener('blur', saveSupabaseSettings);
    });

    // setup authentication checking & listeners
    setupAuthListener();

    // Initial fetch of curriculum from CSV database API
    loadCurriculumCSV();

    // initial render
    renderDailyTab();
    renderViewTab();
    loadSettingsUI();
    updateBadge();

    // auto-expand first day card on view
    setTimeout(() => {
        const firstCard = document.querySelector('.day-card');
        if (firstCard) firstCard.classList.add('expanded');
    }, 300);

    // Keyboard shortcut: Ctrl+S to save
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            const dailyTab = document.getElementById('tab-daily');
            if (dailyTab.classList.contains('active')) {
                e.preventDefault();
                saveDaily();
            }
        }
    });
}

// run
document.addEventListener('DOMContentLoaded', init);

// expose some functions globally for inline onclick
window.toggleDayCard = toggleDayCard;
window.editDay = editDay;
window.deleteDay = deleteDay;
window.toggleSqlHelper = toggleSqlHelper;
window.copySqlScript = copySqlScript;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.loadTestPhoto = loadTestPhoto;
window.switchAuthTab = switchAuthTab;
window.handleAuthSubmit = handleAuthSubmit;
window.handleSignOut = handleSignOut;
window.bypassAuthToLocal = bypassAuthToLocal;
window.saveSubjectSetting = saveSubjectSetting;
window.saveCurriculumConfigSetting = saveCurriculumConfigSetting;
window.loadCurriculumCSV = loadCurriculumCSV;
window.seedDatabaseCurriculum = seedDatabaseCurriculum;
window.showFetchConfigModal = showFetchConfigModal;
window.hideFetchConfigModal = hideFetchConfigModal;
window.handleFetchConfigSubmit = handleFetchConfigSubmit;
