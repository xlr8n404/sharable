'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { Heart, MessageCircle, UserPlus, Menu, X, Settings, LogOut, Share2 } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Alert {
  id: string;
  type: 'like' | 'comment' | 'follow';
  read: boolean;
  created_at: string;
  post_id: string | null;
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
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  useEffect(() => {
    if (menuOpen) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, [menuOpen]);

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
          from_user:profiles!notifications_from_user_id_fkey(full_name, avatar_url, username)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });


    if (!error && data) {
      setAlerts(data as unknown as Alert[]);
      
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

    // Subscribe to notifications changes
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
          fetchAlerts(false); // Refresh without full loading spinner
        })
        .subscribe();

      return channel;
    };

    let channel: any;
    setupRealtime().then(c => channel = c);

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchAlerts]);

  const getAvatarSrc = (alert: Alert) => {
    return alert.from_user.avatar_url
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${alert.from_user.avatar_url}`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${alert.from_user.full_name}`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart size={12} strokeWidth={1.5} className="text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageCircle size={12} strokeWidth={1.5} className="text-blue-500" />;
      case 'follow':
        return <UserPlus size={12} strokeWidth={1.5} className="text-green-500" />;
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
      default:
        return '';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">
      <header className={`fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-black/[0.08] dark:border-white/[0.08] transition-transform duration-300 ${
        isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-bold text-[22px] tracking-tight font-[family-name:var(--font-syne)]">
            Alerts
          </span>
          <button 
            onClick={() => setMenuOpen(true)}
            className="p-2 -mr-2 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <Menu size={24} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[60]">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
            <div className="absolute top-0 right-0 h-full w-72 bg-zinc-100 dark:bg-zinc-900 shadow-2xl animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2 group">
                <div className="flex items-center justify-center w-8 h-8">
                  <Share2 size={32} strokeWidth={2.5} className="text-black dark:text-white" />
                </div>
                <span className="font-bold text-[22px] tracking-tight font-[family-name:var(--font-syne)] text-black dark:text-white">
                  Sharable
                </span>
              </div>
              <button 
                onClick={() => setMenuOpen(false)}
                className="p-2 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={24} strokeWidth={1.5} />
              </button>
            </div>
            <nav className="p-2">
              <button 
                onClick={() => {
                  setMenuOpen(false);
                  router.push('/settings');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <Settings size={24} strokeWidth={1.5} />
                <span className="font-medium">Settings</span>
              </button>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-500 dark:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <LogOut size={24} strokeWidth={1.5} />
                <span className="font-medium">Log out</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      <main className="max-w-xl mx-auto pt-16 pb-20">
        {loading ? (
          <Loader />
        ) : alerts.length > 0 ? (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-4 p-4 transition-colors ${
                  !alert.read ? 'bg-black/5 dark:bg-white/5' : ''
                }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900">
                      <img
                        src={getAvatarSrc(alert)}
                        alt={alert.from_user.full_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  <div className="absolute -bottom-1 -right-1 p-1 bg-white dark:bg-black rounded-full border border-black/5 dark:border-white/5 shadow-sm">
                    {getIcon(alert.type)}
                  </div>
                </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[16px] leading-tight flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold">{alert.from_user.full_name}</span>
                          <span className="text-zinc-500 dark:text-zinc-400">{getMessage(alert)}</span>
                        </p>
                      <p className="text-xs text-zinc-500 mt-1">{formatTime(alert.created_at)}</p>
                    </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">🔔</span>
            </div>
            <h3 className="text-xl font-bold mb-2">No alerts yet</h3>
            <p className="text-zinc-500 max-w-[240px]">When someone interacts with your posts, you'll see it here.</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
