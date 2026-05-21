'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Home, Search, PlusSquare, Bell, UserCircle, LogOut, Settings2 } from 'lucide-react';
import { CreateBottomSheet } from './CreateBottomSheet';
import { useTheme } from 'next-themes';

export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        await fetchUserProfile(session.user.id);
      } else {
        try {
          const response = await fetch('/api/auth/session');
          const data = await response.json();
          if (data.user) {
            setUserId(data.user.id);
            await fetchUserProfile(data.user.id);
          }
        } catch (e) {
          console.error('Failed to get session in DesktopSidebar', e);
        }
      }
    };
    getSession();
  }, []);

  const fetchUserProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, full_name')
        .eq('id', uid)
        .single();
      
      if (!error && data?.avatar_url && data.avatar_url.trim() !== '') {
        setUserAvatarUrl(`/api/media/avatars/${data.avatar_url}`);
      }
      if (!error && data?.full_name) {
        setUserName(data.full_name);
      }
    } catch (e) {
      console.error('Failed to fetch user profile', e);
    }
  };

  const fetchUnreadCount = async () => {
    if (!userId) return;
    try {
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navItems = [
    { href: '/home', icon: Home, label: 'Home' },
    { href: '/search', icon: Search, label: 'Search' },
    { href: '/alerts', icon: Bell, label: 'Alerts', badge: unreadCount },
    { href: '/profile', icon: UserCircle, label: 'Profile', isProfile: true },
  ];

  return (
    <>
      <CreateBottomSheet isOpen={showCreateSheet} onClose={() => setShowCreateSheet(false)} />
      
      {/* Desktop Sidebar - Hidden on Mobile */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-background border-r border-border flex-col z-40 px-4 py-4">
        
        {/* Logo / Branding Area */}
        <div className="h-16 flex items-center px-3 mb-4">
          <h1 className="text-2xl font-bold">Sharable</h1>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative group ${
                  isActive
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2 : 1.5} fill={isActive ? 'currentColor' : 'none'} />
                <span className="font-medium">{item.label}</span>
                
                {item.badge && item.badge > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Create Post Button */}
        <button
          onClick={() => setShowCreateSheet(true)}
          className="w-full px-4 py-3 mb-4 bg-black text-white dark:bg-white dark:text-black rounded-xl font-semibold flex items-center gap-2 justify-center hover:opacity-90 transition-opacity"
        >
          <PlusSquare size={20} />
          Create Post
        </button>

        {/* User Profile Section */}
        <div className="border-t border-border pt-4 space-y-3">
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full px-4 py-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all flex items-center gap-3 text-foreground"
          >
            {theme === 'dark' ? '🌙' : '☀️'}
            <span className="font-medium">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>

          {/* Settings */}
          <Link
            href="/settings"
            className="w-full px-4 py-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all flex items-center gap-3 text-foreground"
          >
            <Settings2 size={20} />
            <span className="font-medium">Settings</span>
          </Link>

          {/* User Info */}
          {userAvatarUrl && (
            <div className="px-3 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 flex items-center gap-3">
              <img
                src={userAvatarUrl}
                alt="User profile"
                className="w-10 h-10 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{userName || 'User'}</p>
              </div>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-all flex items-center gap-3 text-red-600 dark:text-red-400 font-medium"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
