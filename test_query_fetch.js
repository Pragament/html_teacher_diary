const url = "https://ndajyhculegzhxqwythx.supabase.co/rest/v1/daily_entries?select=id%2Cteacher%3Ausers%21teacher_id%28id%2Cname%2Cemail%2Cavatar_url%29&limit=1";
const key = "sb_publishable_4HO0WCszOpLVrxLbx0Io_Q_AbeN86ev";

fetch(url, {
    headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`
    }
}).then(res => res.json()).then(console.log).catch(console.error);
