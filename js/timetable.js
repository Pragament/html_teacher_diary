// ================================================================
//  TIMETABLE FETCH LOGIC (Teacher Side)
// ================================================================

window.currentTimetableMap = {};

async function fetchTodayTimetable(dateStr) {
    const client = getSupabaseClient();
    if (!client) return {};

    const d = new Date(dateStr);
    let dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday...
    if (dayOfWeek === 0) dayOfWeek = 7; // Supabase check constraint 1-7 (assuming 1=Monday, 7=Sunday)

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session || !session.user) return {};

        const { data: timetable, error } = await client
            .from('timetable')
            .select('*')
            .eq('teacher_id', session.user.id)
            .eq('day_of_week', dayOfWeek);

        if (error) {
            console.warn('Error fetching timetable:', error);
            return {};
        }

        const map = {};
        timetable.forEach(t => {
            map[t.period_number] = {
                classSection: t.class_section,
                subject: t.subject
            };
        });

        window.currentTimetableMap = map;
        return map;
    } catch (err) {
        console.warn('Exception fetching timetable:', err);
        return {};
    }
}
