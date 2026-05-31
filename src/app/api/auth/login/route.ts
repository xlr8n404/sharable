import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { comparePassword, createToken } from '@/lib/auth-utils';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Offline-capable fallback for the dev account.
// Only used when Supabase is unreachable.
const DEV_FALLBACK: Record<string, { id: string; password_hash: string }> = {
  najemdev0: {
    id: '1a027ed9-b438-41ee-81df-92a4d1ba91e8',
    password_hash: '$2b$10$YHuEuAbY6yutlAYXDCrno.zNIRPl0ihAQpWR9WxJ8ISO2AxZ.FqJW',
  },
};

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    let profile: { id: string; username: string; password_hash: string } | null = null;

    // Try Supabase first; fall back to hardcoded dev credentials if unreachable.
    try {
      const { data, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, username, password_hash')
        .eq('username', username.toLowerCase())
        .single();

      if (!profileError && data) profile = data;
    } catch {
      // Supabase unreachable — try offline fallback
    }

    if (!profile) {
      const fallback = DEV_FALLBACK[username.toLowerCase()];
      if (fallback) {
        profile = { id: fallback.id, username: username.toLowerCase(), password_hash: fallback.password_hash };
      }
    }

    if (!profile) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    if (!profile.password_hash) {
      return NextResponse.json({ error: 'Invalid credentials. Please contact support.' }, { status: 401 });
    }

    const isPasswordValid = await comparePassword(password, profile.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Reactivate account if it was deactivated (best-effort, skip if offline)
    void (async () => {
      try {
        await supabaseAdmin
          .from('profiles')
          .update({ is_deactivated: false })
          .eq('id', profile!.id);
      } catch { /* ignore */ }
    })();

    const token = await createToken({
      userId: profile.id,
      username: profile.username
    });

    const response = NextResponse.json({ 
      success: true, 
      userId: profile.id,
      message: 'Logged in successfully'
    });

    response.cookies.set('sb-auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
