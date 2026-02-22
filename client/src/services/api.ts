import axios from 'axios';
import { supabase } from '../lib/supabase';

// Create Axios instance
const api = axios.create({
  baseURL: import.meta.env.PROD
    ? 'functions/v1'
    : (import.meta.env.VITE_API_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`),
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
      } else {
        config.headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
