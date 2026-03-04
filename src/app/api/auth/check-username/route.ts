import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username || username.length < 3) {
      return NextResponse.json({ available: false, error: 'Username must be at least 3 characters' }, { status: 400 });
    }

    const { data } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('username', username.toLowerCase())
      .single();

    return NextResponse.json({ available: !data });
  } catch (error: any) {
    return NextResponse.json({ available: true });
  }
}
