import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select(`
        *,
        user1:profiles!conversations_user1_id_fkey(id, full_name, username, avatar_url),
        user2:profiles!conversations_user2_id_fkey(id, full_name, username, avatar_url)
      `)
      .or(`user1_id.eq.${user_id},user2_id.eq.${user_id}`)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const conversationsWithLastMessage = await Promise.all(
      (data || []).map(async (conv) => {
        const { data: lastMsg } = await supabaseAdmin
          .from('messages')
          .select('content, created_at, sender_id')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const { data: unreadData } = await supabaseAdmin
          .from('messages')
          .select('id', { count: 'exact' })
          .eq('conversation_id', conv.id)
          .eq('read', false)
          .neq('sender_id', user_id);

        return {
          ...conv,
          last_message: lastMsg,
          unread_count: unreadData?.length || 0,
        };
      })
    );

    return NextResponse.json({ data: conversationsWithLastMessage });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user1_id, user2_id } = await req.json();

    if (!user1_id || !user2_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (user1_id === user2_id) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
    }

    const sorted = [user1_id, user2_id].sort();

    const { data: existing } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('user1_id', sorted[0])
      .eq('user2_id', sorted[1])
      .single();

    if (existing) {
      return NextResponse.json({ data: existing });
    }

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .insert({ user1_id: sorted[0], user2_id: sorted[1] })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing conversation id' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
