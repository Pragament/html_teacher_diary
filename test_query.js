const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

async function test() {
    const { data, error } = await supabase
        .from('daily_entries')
        .select(`
            id,
            teacher:users!teacher_id(id, name, email, avatar_url)
        `)
        .limit(1);
    
    console.log("Error:", error);
}

test();
