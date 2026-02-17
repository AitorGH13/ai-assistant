import axios from 'axios';
import { supabase } from '../lib/supabase';

// Create Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api', // Default to 3001 as per previous config
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add Auth Token
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
    // Also send user ID if needed by backend (though backend should verify token)
    if (session.user) {
        config.headers['X-User-Id'] = session.user.id;
    }
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
