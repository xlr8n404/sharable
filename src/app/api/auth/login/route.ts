import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { comparePassword, createToken } from '@/lib/auth-utils';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, password_hash')
      .eq('username', username.toLowerCase())
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    if (!profile.password_hash) {
      return NextResponse.json({ error: 'Invalid credentials. Please contact support.' }, { status: 401 });
    }

    const isPasswordValid = await comparePassword(password, profile.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

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
