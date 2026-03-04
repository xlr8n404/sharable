import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createToken, getAppUrl } from '@/lib/auth-utils';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const appUrl = getAppUrl();

  if (!code) {
    return NextResponse.redirect(`${appUrl}/login?error=google_cancelled`);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${appUrl}/login?error=google_failed`);
    }

    const tokenData = await tokenRes.json();
    const accessToken: string = tokenData.access_token;
    const refreshToken: string | undefined = tokenData.refresh_token;

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${appUrl}/login?error=google_failed`);
    }

    const googleUser = await userRes.json();
    const googleEmail: string = googleUser.email;
    const googleName: string = googleUser.name || '';
    const googleAvatar: string = googleUser.picture || '';
    const googleId: string = googleUser.id;

    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .eq('google_id', googleId)
      .single();

    if (!profile) {
      const { data: profileByEmail } = await supabaseAdmin
        .from('profiles')
        .select('id, username')
        .eq('email', googleEmail)
        .single();

      if (profileByEmail) {
        await supabaseAdmin
          .from('profiles')
          .update({ 
            google_id: googleId, 
            avatar_url: googleAvatar,
            google_refresh_token: refreshToken // Only update if it exists
          })
          .eq('id', profileByEmail.id);
        profile = profileByEmail;
      }
    } else {
      // Always update refresh token if we got a new one
      if (refreshToken) {
        await supabaseAdmin
          .from('profiles')
          .update({ google_refresh_token: refreshToken })
          .eq('id', profile.id);
      }
    }

    if (!profile) {
      const baseUsername = googleEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 12);
      let username = baseUsername;
      let suffix = 0;

      while (true) {
        const { data: existing } = await supabaseAdmin
          .from('profiles')
          .select('username')
          .eq('username', username)
          .single();
        if (!existing) break;
        suffix++;
        username = `${baseUsername}${suffix}`;
      }

      const { data: newProfile, error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          full_name: googleName.slice(0, 15),
          username,
          avatar_url: googleAvatar,
          email: googleEmail,
          google_id: googleId,
          google_refresh_token: refreshToken,
          password_hash: null,
        })
        .select('id, username')
        .single();

      if (insertError || !newProfile) {
        return NextResponse.redirect(`${appUrl}/login?error=profile_create_failed`);
      }

      profile = newProfile;
    }

    const token = await createToken({
      userId: profile.id,
      username: profile.username,
    });

    const response = NextResponse.redirect(`${appUrl}/home`);
    response.cookies.set('sb-auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.redirect(`${appUrl}/login?error=server_error`);
  }
}
