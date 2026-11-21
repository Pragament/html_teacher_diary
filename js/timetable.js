// ================================================================
//  TIMETABLE FETCH LOGIC (Teacher Side)
//  Source of truth: public.timetable, maintained by the principal in the Timetable Editor.
//  Reads go through the get_my_periods(date) RPC, which returns ONLY the signed-in teacher's periods for that
//  date (master timetable + the principal's substitutions / date overrides), with period timings.
// ================================================================

window.currentTimetableMap = {};
window.timetableLoaded = false;      // true once a fetch succeeded (so the UI knows "no periods" is real, not an error)
window.timetableLoadError = null;

function formatPeriodTime(t) {
    return t ? String(t).slice(0, 5) : '';
}

async function fetchTodayTimetable(dateStr) {
    const client = getSupabaseClient();
    if (!client) return {};

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session || !session.user) return {};

        const { data, error } = await client.rpc('get_my_periods', { p_date: dateStr });
        if (error) {
            window.timetableLoaded = false;
            window.timetableLoadError = error.message;
            console.warn('Error fetching timetable:', error.message);
            return {};
        }

        const map = {};
        (data || []).forEach(r => {
            const cur = map[r.period_number];
            if (cur) {
                // combined class: same teacher, same period, several sections -> keep first, remember the others
                cur.combinedWith.push(r.class_section);
                return;
            }
            map[r.period_number] = {
                classSection: r.class_section,
                subject: r.subject,
                substituteFor: r.substitute_for || '',
                startTime: formatPeriodTime(r.start_time),
                endTime: formatPeriodTime(r.end_time),
                combinedWith: []
            };
        });

        window.timetableLoaded = true;
        window.timetableLoadError = null;
        window.currentTimetableMap = map;
        return map;
    } catch (err) {
        window.timetableLoaded = false;
        window.timetableLoadError = err.message || String(err);
        console.warn('Exception fetching timetable:', err);
        return {};
    }
}

// ---- Live updates: one Realtime subscription per session ------------------------------------------------
// The principal's save rewrites the teacher's timetable rows, which fires events here. We do NOT re-render
// automatically (that could wipe text the teacher is typing); we show a banner and refresh on click.
function showTimetableUpdatedBanner() {
    if (document.getElementById('timetableUpdatedBanner')) return;
    const b = document.createElement('div');
    b.id = 'timetableUpdatedBanner';
    b.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.3);font:14px system-ui;display:flex;gap:12px;align-items:center;';
    b.innerHTML = '<span>Your timetable was updated by the principal. Save your entries, then refresh.</span>' +
        '<button style="background:#fff;color:#1d4ed8;border:0;border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:600">Refresh periods</button>' +
        '<button aria-label="Dismiss" style="background:transparent;color:#fff;border:0;cursor:pointer;font-size:16px">×</button>';
    const [refreshBtn, closeBtn] = b.querySelectorAll('button');
    refreshBtn.onclick = () => { b.remove(); if (typeof renderDailyTab === 'function') renderDailyTab(); };
    closeBtn.onclick = () => b.remove();
    document.body.appendChild(b);
}

async function onTimetableChanged() {
    const dateInput = document.getElementById('dailyDate');
    const dateStr = (dateInput && dateInput.value) || (typeof getTodayStr === 'function' ? getTodayStr() : null);
    if (!dateStr) return;
    const before = JSON.stringify(window.currentTimetableMap || {});
    const after = JSON.stringify(await fetchTodayTimetable(dateStr));
    if (before !== after) showTimetableUpdatedBanner();
}

function subscribeTimetableChanges() {
    const client = getSupabaseClient();
    if (!client || window._ttChannel) return;
    client.auth.getSession().then(({ data: { session } }) => {
        if (!session || window._ttChannel) return;
        let timer = null;
        window._ttChannel = client
            .channel('timetable-' + session.user.id)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'timetable', filter: 'teacher_id=eq.' + session.user.id },
                () => { clearTimeout(timer); timer = setTimeout(onTimetableChanged, 1500); })   // one save = many row events
            .subscribe();
    }).catch(e => console.warn('Timetable realtime unavailable:', e));
}
window.subscribeTimetableChanges = subscribeTimetableChanges;
