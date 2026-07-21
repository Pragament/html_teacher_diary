const url = "https://ndajyhculegzhxqwythx.supabase.co/rest/v1";
const key = "sb_publishable_4HO0WCszOpLVrxLbx0Io_Q_AbeN86ev";

const headers = {
    "apikey": key,
    "Authorization": `Bearer ${key}`
};

async function test() {
    const users = await fetch(`${url}/users?select=*`, { headers }).then(r => r.json());
    console.log("USERS:", users);
    
    const entries = await fetch(`${url}/daily_entries?select=*`, { headers }).then(r => r.json());
    console.log("ENTRIES:", entries);
}

test();
