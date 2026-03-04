'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useRouter, usePathname } from 'next/navigation';

export default function RealtimeNotifications() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let user_id: string | null = null;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      user_id = session.user.id;

      // Global Notification Listener
      const notificationsChannel = supabase
        .channel(`global-notifications:${user_id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user_id}`
        }, (payload) => {
          // Only show toast if NOT on the alerts page
          if (pathname !== '/alerts' && pathname !== '/notifications') {
            toast.info('New alert received!', {
              action: {
                label: 'View',
                onClick: () => router.push('/alerts')
              }
            });
          }
        })
        .subscribe();

      // Global Message Listener
      const messagesChannel = supabase
        .channel(`global-messages:${user_id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        }, async (payload) => {
          // Check if this message is for a conversation I'm part of
          const { data: conv } = await supabase
            .from('conversations')
            .select('id, user1_id, user2_id')
            .eq('id', payload.new.conversation_id)
            .single();

          if (conv && (conv.user1_id === user_id || conv.user2_id === user_id)) {
            // It's for me!
            if (payload.new.sender_id !== user_id) {
               // Only show toast if NOT on the messages page for this conversation
               if (pathname !== '/messages') {
                 toast('New message', {
                   description: payload.new.content,
                   action: {
                     label: 'Reply',
                     onClick: () => router.push('/messages')
                   }
                 });
               }
            }
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(notificationsChannel);
        supabase.removeChannel(messagesChannel);
      };
    };

    setup();
  }, [pathname, router]);

  return null;
}
