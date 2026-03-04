import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'all';

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [], posts: [] });
    }

    const searchTerm = `%${query}%`;

    if (type === 'users' || type === 'all') {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, username, avatar_url, bio')
        .or(`username.ilike.${searchTerm},full_name.ilike.${searchTerm}`)
        .limit(20);

      if (usersError) throw usersError;

      if (type === 'users') {
        return NextResponse.json({ users: users || [] });
      }

      if (type === 'all') {
        const { data: posts, error: postsError } = await supabaseAdmin
          .from('posts')
          .select(`
            id,
            content,
            media_url,
            media_type,
            created_at,
            user:profiles(id, full_name, username, avatar_url)
          `)
          .ilike('content', searchTerm)
          .order('created_at', { ascending: false })
          .limit(20);

        if (postsError) throw postsError;

        return NextResponse.json({ 
          users: users || [], 
          posts: posts || [] 
        });
      }
    }

    if (type === 'posts') {
      const { data: posts, error: postsError } = await supabaseAdmin
        .from('posts')
        .select(`
          id,
          content,
          media_url,
          media_type,
          created_at,
          user:profiles(id, full_name, username, avatar_url)
        `)
        .ilike('content', searchTerm)
        .order('created_at', { ascending: false })
        .limit(20);

      if (postsError) throw postsError;

      return NextResponse.json({ posts: posts || [] });
    }

    return NextResponse.json({ users: [], posts: [] });
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
