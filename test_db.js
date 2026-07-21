const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

async function checkData() {
    console.log("Fetching users...");
    const { data: users, error: usersErr } = await client.from('users').select('*');
    console.log("Users:", users);
    
    console.log("Fetching entries...");
    const { data: entries, error: entriesErr } = await client.from('daily_entries').select('*');
    console.log("Entries:", entries);
}

checkData();
