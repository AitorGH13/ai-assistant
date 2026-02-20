import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://nbleuwsnbxrmcxpmueeh.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function run() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  const { data, error: signUpError } = await supabase.auth.signUp({
    email: 'test' + Date.now() + '@example.com',
    password: 'password123'
  });
  
  if (signUpError) {
    console.error("SignUp error:", signUpError);
    process.exit(1);
  }
  
  const token = data.session.access_token;
  
  console.log("Token:", token.substring(0, 10));
  
  const postRes = await fetch(SUPABASE_URL + '/functions/v1/chat/' + crypto.randomUUID() + '/message', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        messages: [{ role: 'user', content: "Respond with exactly: I am alive" }]
    })
  });
  const text = await postRes.text();
  console.log("Post Response:", text);

  // Now list
  const listRes = await fetch(SUPABASE_URL + '/functions/v1/chat', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  });
  const listData = await listRes.json();
  console.log("Conversations found:", listData.length)
  if (listData.length > 0) {
      console.log("Latest conversation:", listData[0])
  }

  process.exit(0);
}

run();
