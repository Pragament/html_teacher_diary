// ================================================================
//  ADMIN PANEL LOGIC
// ================================================================

function renderAdminPanel() {
    const container = document.getElementById('adminPanelContent');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
            <div class="card" style="margin-bottom:0;">
                <h4>Upload Timetable (CSV)</h4>
                <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">Format: Teacher Email, Day (1-7), Period (1-8), Class-Section, Subject</p>
                <div style="display:flex; gap:12px; align-items:center;">
                    <input type="file" id="adminTimetableCsv" accept=".csv" style="padding:6px; font-size:13px;" />
                    <button class="btn btn-primary btn-sm" onclick="handleTimetableUpload()">Upload</button>
                </div>
                <div id="timetableUploadStatus" style="font-size:13px; margin-top:8px;"></div>
            </div>
        </div>
    `;
}

async function handleTimetableUpload() {
    const fileInput = document.getElementById('adminTimetableCsv');
    const statusDiv = document.getElementById('timetableUploadStatus');
    
    if (!fileInput.files.length) {
        showToast('Please select a CSV file first', 'warning');
        return;
    }
    
    statusDiv.innerHTML = '<span class="spinner"></span> Processing...';
    
    try {
        const file = fileInput.files[0];
        const text = await file.text();
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        
        const client = getSupabaseClient();
        if (!client) throw new Error("Not connected to Supabase");
        
        const { data: { session } } = await client.auth.getSession();
        if (!session) throw new Error("Not authenticated");
        
        let successCount = 0;
        let skipCount = 0;
        
        // Very basic CSV parsing (assumes no commas in values)
        // Format: email, day, period, class, subject
        for (let i = 1; i < lines.length; i++) { // skip header
            const cols = lines[i].split(',').map(c => c.trim());
            if (cols.length < 5) continue;
            
            const [email, dayStr, periodStr, classSec, subject] = cols;
            const day = parseInt(dayStr);
            const period = parseInt(periodStr);
            
            // Look up teacher ID by email (in users table)
            const { data: teacherUser } = await client.from('users').select('id').eq('email', email).maybeSingle();
            
            if (teacherUser) {
                // Upsert timetable row
                const { error } = await client.from('timetable').upsert({
                    teacher_id: teacherUser.id,
                    day_of_week: day,
                    period_number: period,
                    class_section: classSec,
                    subject: subject
                }, { onConflict: 'teacher_id,day_of_week,period_number' });
                
                if (!error) successCount++;
                else skipCount++;
            } else {
                skipCount++; // Teacher not found
            }
        }
        
        statusDiv.innerHTML = `<span style="color:green;">✅ Upload complete! ${successCount} entries added/updated, ${skipCount} skipped.</span>`;
        fileInput.value = '';
        
    } catch (err) {
        console.error(err);
        statusDiv.innerHTML = `<span style="color:red;">❌ Error: ${err.message}</span>`;
    }
}

// Intercept tab changes to render admin panel
document.addEventListener('DOMContentLoaded', () => {
    const adminBtn = document.querySelector('button[data-tab="admin"]');
    if (adminBtn) {
        adminBtn.addEventListener('click', renderAdminPanel);
    }
});
