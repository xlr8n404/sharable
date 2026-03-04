import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { user_id, post_id } = await req.json();

    if (!user_id || !post_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if already reposted
    const { data: existingRepost } = await supabaseAdmin
      .from('reposts')
      .select('id')
      .eq('user_id', user_id)
      .eq('post_id', post_id)
      .single();

    if (existingRepost) {
      return NextResponse.json({ error: 'Already reposted' }, { status: 409 });
    }

    // Insert into reposts table
    const { error: repostError } = await supabaseAdmin
      .from('reposts')
      .insert({ user_id, post_id });

    if (repostError) throw repostError;

    // Create a new post row with reposted_id
    const { data: newPost, error: postError } = await supabaseAdmin
      .from('posts')
      .insert({ 
        user_id, 
        reposted_id: post_id,
        content: '' // Reposts don't have their own content for now as per requirement
      })
      .select()
      .single();

    if (postError) throw postError;

    // Create notification for original poster
    const { data: originalPost } = await supabaseAdmin
      .from('posts')
      .select('user_id')
      .eq('id', post_id)
      .single();

    if (originalPost && originalPost.user_id !== user_id) {
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: originalPost.user_id,
          from_user_id: user_id,
          type: 'repost',
          post_id: post_id
        });
    }

    return NextResponse.json({ success: true, data: newPost });
  } catch (error: any) {
    console.error('Repost error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user_id, post_id } = await req.json();

    if (!user_id || !post_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Delete from reposts table
    const { error: repostError } = await supabaseAdmin
      .from('reposts')
      .delete()
      .eq('user_id', user_id)
      .eq('post_id', post_id);

    if (repostError) throw repostError;

    // Delete from posts table
    const { error: postError } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('user_id', user_id)
      .eq('reposted_id', post_id);

    if (postError) throw postError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Unrepost error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');
    const post_id = searchParams.get('post_id');

    if (!user_id || !post_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('reposts')
      .select('id')
      .eq('user_id', user_id)
      .eq('post_id', post_id)
      .single();

    return NextResponse.json({ isReposted: !!data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
