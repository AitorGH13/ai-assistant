import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nbleuwsnbxrmcxpmueeh.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function run() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Can just create a new anonymous user/session or sign in to get a token
  // Let's sign up a dummy user to get a fresh token
  const { data, error: signUpError } = await supabase.auth.signUp({
    email: 'test' + Date.now() + '@example.com',
    password: 'password123'
  });
  
  if (signUpError) {
    console.error("SignUp error:", signUpError);
    process.exit(1);
  }
  
  const token = data.session.access_token;
  
  console.log("Token:", token.substring(0, 10) + '...');
  
  const res = await fetch(SUPABASE_URL + '/functions/v1/chat', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  });
  
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
  process.exit(0);
}

run();
