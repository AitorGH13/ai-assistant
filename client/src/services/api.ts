import axios from 'axios';
import { supabase } from '../lib/supabase';

// Create Axios instance
const api = axios.create({
  baseURL: import.meta.env.PROD
    ? 'functions/v1'
    : (import.meta.env.VITE_API_URL || 'https://nbleuwsnbxrmcxpmueeh.supabase.co/functions/v1'),
  headers: {
    'Content-Type': 'application/json',
  },
});


// Request interceptor to add Auth Token
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (config.headers) {
    if (typeof config.headers.set === 'function') {
      config.headers.set('apikey', anonKey);
    } else {
      config.headers['apikey'] = anonKey;
    }
    
    if (session?.access_token) {
      if (typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${session.access_token}`);
        if (session.user) {
          config.headers.set('X-User-Id', session.user.id);
        }
      } else {
        config.headers['Authorization'] = `Bearer ${session.access_token}`;
        if (session.user) {
          config.headers['X-User-Id'] = session.user.id;
        }
      }
    } else {
      if (typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${anonKey}`);
      } else {
        config.headers['Authorization'] = `Bearer ${anonKey}`;
      }
    }
  } else {
    console.warn("API Interceptor: config.headers is undefined!");
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
