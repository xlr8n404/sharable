'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { Heart, MessageCircle, UserPlus, Repeat, Bell, AtSign, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

interface Alert {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'repost' | 'mention' | 'message' | 'post';
  read: boolean;
  created_at: string;
  post_id: string | null;
  comment_id?: string | null;
  from_user: {
    full_name: string;
    avatar_url: string;
    username: string;
  };
}

export default function AlertsPage() {
  const isHeaderVisible = useScrollDirection();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        type,
        read,
        created_at,
        post_id,
        comment_id,
        from_user:profiles!notifications_from_user_id_fkey(full_name, avatar_url, username)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAlerts(data as unknown as Alert[]);

      // Mark all as read
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchAlerts();

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, () => {
          fetchAlerts(false);
        })
        .subscribe();

      return channel;
    };

    let channel: ReturnType<typeof supabase.channel> | undefined;
    setupRealtime().then(c => { channel = c; });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchAlerts]);

  const getAvatarSrc = (alert: Alert) => {
    return alert.from_user.avatar_url
      ? `/api/media/avatars/${alert.from_user.avatar_url}`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(alert.from_user.full_name)}`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40">
            <Heart size={11} className="text-red-500 fill-red-500" />
          </span>
        );
      case 'comment':
        return (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40">
            <MessageCircle size={11} className="text-blue-500" />
          </span>
        );
      case 'follow':
        return (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/40">
            <UserPlus size={11} className="text-green-500" />
          </span>
        );
      case 'repost':
        return (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <Repeat size={11} className="text-emerald-500" />
          </span>
        );
      case 'mention':
        return (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/40">
            <AtSign size={11} className="text-purple-500" />
          </span>
        );
      case 'message':
        return (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40">
            <MessageCircle size={11} className="text-indigo-500" />
          </span>
        );
      case 'post':
        return (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40">
            <FileText size={11} className="text-amber-500" />
          </span>
        );
      default:
        return null;
    }
  };

  const getMessage = (alert: Alert) => {
    switch (alert.type) {
      case 'like':
        return 'liked your post';
      case 'comment':
        return 'commented on your post';
      case 'follow':
        return 'started following you';
      case 'repost':
        return 'reposted your post';
      case 'mention':
        return 'mentioned you in a comment';
      case 'message':
        return 'sent you a message';
      case 'post':
        return 'shared a new post';
      default:
        return 'interacted with you';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Navigate when clicking on the row body (not avatar/name)
  const handleRowClick = (alert: Alert) => {
    if (alert.type === 'follow') {
      router.push(`/${alert.from_user.username}`);
    } else if (alert.type === 'message') {
      router.push('/messages');
    } else if (alert.post_id) {
      router.push(`/post/${alert.post_id}`);
    }
  };

  // Navigate to profile when clicking avatar or name
  const handleProfileClick = (e: React.MouseEvent, username: string) => {
    e.stopPropagation();
    router.push(`/${username}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">
      {/* Top Bar — 64px */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 bg-background transition-transform duration-300 ${
          isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="px-4 h-16 flex items-center">
          <span className="font-bold text-2xl tracking-tight font-[family-name:var(--font-syne)]">
            Alerts
          </span>
        </div>
      </header>

      <main className="w-full pt-16 pb-20">
        {loading ? (
          <div>
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <Skeleton className="w-14 h-14 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-[30%] bg-zinc-100 dark:bg-zinc-900" />
                  <Skeleton className="h-3.5 w-[50%] bg-zinc-100 dark:bg-zinc-900" />
                  <Skeleton className="h-2.5 w-[10%] bg-zinc-50 dark:bg-zinc-950" />
                </div>
              </div>
            ))}
          </div>
        ) : alerts.length > 0 ? (
          <div>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => handleRowClick(alert)}
                className={`flex items-center gap-3 px-4 min-h-[72px] py-3 cursor-pointer transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03] active:bg-black/[0.06] dark:active:bg-white/[0.06] ${
                  !alert.read ? 'bg-black/[0.025] dark:bg-white/[0.025]' : ''
                }`}
              >
                {/* Avatar — 56px, clickable → profile */}
                <div
                  className="relative shrink-0 cursor-pointer"
                  onClick={(e) => handleProfileClick(e, alert.from_user.username)}
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                    <img
                      src={getAvatarSrc(alert)}
                      alt={alert.from_user.full_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(alert.from_user.full_name)}`;
                      }}
                    />
                  </div>
                  {/* Type badge */}
                  <div className="absolute -bottom-0.5 -right-0.5">
                    {getIcon(alert.type)}
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  {/* Line 1: Full name (16px) */}
                  <p
                    className="font-bold text-[16px] cursor-pointer hover:underline truncate"
                    onClick={(e) => handleProfileClick(e, alert.from_user.username)}
                  >
                    {alert.from_user.full_name}
                  </p>
                  {/* Line 2: Content (14px) */}
                  <p className="text-[14px] text-zinc-500 dark:text-zinc-400 leading-snug truncate">
                    {getMessage(alert)}
                  </p>
                  {/* Line 3: Timing (12px) */}
                  <p className="text-[12px] text-zinc-400 dark:text-zinc-600 mt-0.5">
                    {formatTime(alert.created_at)}
                  </p>
                </div>

                {/* Unread dot */}
                {!alert.read && (
                  <div className="w-2 h-2 rounded-full bg-black dark:bg-white shrink-0" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-7 h-7 text-zinc-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold mb-2">No alerts yet</h3>
            <p className="text-zinc-500 text-sm max-w-[240px]">
              When someone follows you, likes or comments on your posts, or sends you a message, you'll see it here.
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
