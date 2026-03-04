import { NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/auth-utils';

export async function GET() {
  const appUrl = getAppUrl();
  const clientId = process.env.GOOGLE_CLIENT_ID!;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.file',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
