'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Home, MessageCircle, PlusSquare, Bell, UserCircle } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        // Fallback to internal API
        try {
          const response = await fetch('/api/auth/session');
          const data = await response.json();
          if (data.user) setUserId(data.user.id);
        } catch (e) {
          console.error('Failed to get session in BottomNav', e);
        }
      }
    };
    getSession();
  }, []);

    const fetchUnreadCount = async () => {
      if (!userId) return;
      try {
        // Fetch unread alerts count instead of messages
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('read', false);
        
        if (!error && count !== null) {
          setUnreadCount(count);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    useEffect(() => {
      if (!userId) return;
      fetchUnreadCount();

      // Subscribe to new alerts
      const channel = supabase
        .channel('unread_alerts')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
          },
          () => fetchUnreadCount()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [userId]);

    const navItems = [
      { href: '/home', icon: Home },
      { href: '/messages', icon: MessageCircle },
      { href: '/post/create', icon: PlusSquare },
      { href: '/alerts', icon: Bell },
      { href: '/profile', icon: UserCircle },
    ];

      return (
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-black/10 dark:border-white/10 h-16">
            <div className="max-w-xl mx-auto flex items-center justify-between px-4 h-full">
              {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
                return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-center transition-all relative w-12 h-12 rounded-2xl group ${
                        isActive 
                          ? 'text-black dark:text-white' 
                          : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}
                      >
                      <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                        isActive 
                          ? 'bg-black/5 dark:bg-white/10' 
                          : 'group-hover:bg-black/5 dark:group-hover:bg-white/5'
                      }`}>
                        <Icon 
                          size={24} 
                          strokeWidth={isActive ? 2.5 : 2} 
                          fill={isActive ? 'currentColor' : 'none'} 
                        />
                      </div>
                      
                      {item.href === '/alerts' && unreadCount > 0 && (
  <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[14px] h-3.5 px-1 flex items-center justify-center border-2 border-white dark:border-black">
  {unreadCount > 9 ? '9+' : unreadCount}
  </span>
  )}
</Link>
);
})}
      </div>
    </nav>
  );
}
