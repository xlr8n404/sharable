import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const baseSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Custom auth proxy to use our own session API
const authProxy = {
  ...baseSupabase.auth,
  getUser: async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.user) {
        return { data: { user: data.user }, error: null };
      }
      return { data: { user: null }, error: new Error('No session') };
    } catch (error) {
      return { data: { user: null }, error };
    }
  },
  getSession: async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.user) {
        // Mock a session object
        return { 
          data: { 
            session: { 
              user: data.user,
              access_token: 'mock-token',
              refresh_token: 'mock-token',
              expires_in: 3600,
              expires_at: Math.floor(Date.now() / 1000) + 3600
            } 
          }, 
          error: null 
        };
      }
      return { data: { session: null }, error: null };
    } catch (error) {
      return { data: { session: null }, error };
    }
  },
  signOut: async () => {
    // Clear the cookie by hitting a logout API or just clearing it on client
    // For simplicity, we can just clear it on client if it's not httpOnly,
    // but our API set it as httpOnly, so we need a logout API.
    await fetch('/api/auth/logout', { method: 'POST' });
    return { error: null };
  }
};

export const supabase = new Proxy(baseSupabase, {
  get(target, prop) {
    if (prop === 'auth') {
      return authProxy;
    }
    return (target as any)[prop];
  }
});
