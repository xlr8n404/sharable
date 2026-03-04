import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hashPassword, createToken } from '@/lib/auth-utils';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const { username, password, fullName, dob, gender, avatarUrl } = await request.json();
    
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    if (username.length > 15) {
      return NextResponse.json({ error: 'Username cannot exceed 15 characters' }, { status: 400 });
    }

    if (fullName && fullName.length > 15) {
      return NextResponse.json({ error: 'Full name cannot exceed 15 characters' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('username', username.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
    }

      const hashedPassword = await hashPassword(password);

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: `${username.toLowerCase()}@shareit.internal`,
        password,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        return NextResponse.json({ error: authError?.message || 'Failed to create auth user' }, { status: 500 });
      }

      const userId = authData.user.id;

      const { error: profileError } = await supabaseAdmin.from('profiles').insert({
        id: userId,
        full_name: fullName,
        username: username.toLowerCase(),
        date_of_birth: dob || null,
        gender: gender || null,
        avatar_url: avatarUrl || '',
        password_hash: hashedPassword
      });

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

    const token = await createToken({
      userId: userId,
      username: username.toLowerCase()
    });

    const response = NextResponse.json({ 
      success: true, 
      userId: userId,
      message: 'Account created successfully'
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
