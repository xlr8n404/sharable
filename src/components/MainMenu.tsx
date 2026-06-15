'use client';

import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Settings, Settings2, LogOut, Plus, Home, Bell, UserCircle, PlusSquare, Moon, Sun, BookOpen, UserPlus, MessageCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface MainMenuProps {
  open: boolean;
  onClose: () => void;
  avatarSrc: string | null;
  feedMode?: string;
  onFeedModeChange?: (mode: 'explore' | 'following') => void;
}

export function MainMenu({ open, onClose, avatarSrc, feedMode, onFeedModeChange }: MainMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <AnimatePresence>
      {open && (
        <div key="main-menu-overlay" className="fixed inset-0 z-[100]">
          <motion.div
            key="main-menu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="main-menu-content"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-0 left-0 h-full w-[85%] max-w-[320px] bg-background shadow-2xl flex flex-col"
          >
            <div className="flex-1 overflow-y-auto">
              {/* Search bar */}
              <div className="h-16 flex items-center px-3">
                <div
                  className="flex-1 relative flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-full px-3 h-12 cursor-pointer"
                  onClick={() => { onClose(); router.push('/search'); }}
                >
                  <Search size={24} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
                  <span className="flex-1 px-2 text-sm text-zinc-400 select-none">Search Sharable</span>
                </div>
              </div>

              {/* Explore / Following pills */}
              {onFeedModeChange && (
                <div className="h-16 flex items-center gap-3 px-4">
                  <button
                    onClick={() => { onFeedModeChange('explore'); onClose(); }}
                    className={`flex-1 h-10 rounded-full text-sm font-semibold transition-all ${
                      feedMode === 'explore'
                        ? 'bg-black dark:bg-white text-white dark:text-black'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                  >
                    Explore
                  </button>
                  <button
                    onClick={() => { onFeedModeChange('following'); onClose(); }}
                    className={`flex-1 h-10 rounded-full text-sm font-semibold transition-all ${
                      feedMode === 'following'
                        ? 'bg-black dark:bg-white text-white dark:text-black'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                  >
                    Following
                  </button>
                </div>
              )}

              {/* Post create shortcut */}
              <div className="h-16 flex items-center gap-3 px-4">
                <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center border border-zinc-300 dark:border-zinc-700">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle size={24} strokeWidth={1.5} className="text-zinc-500 dark:text-zinc-400" />
                  )}
                </div>
                <Link
                  href="/create/post"
                  onClick={onClose}
                  className="flex-1 flex items-center justify-between h-11 bg-zinc-100 dark:bg-zinc-900 rounded-full px-4 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
                >
                  <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate">Anything sharable today?</span>
                  <Plus size={18} className="text-zinc-500 dark:text-zinc-400 shrink-0 ml-2" />
                </Link>
              </div>

              {/* Nav shortcuts */}
              <div className="h-16 flex items-center justify-around px-2">
                {[
                  { href: '/home', icon: Home, label: 'Home' },
                  { href: '/search', icon: Search, label: 'Search' },
                  { href: '/create/post', icon: PlusSquare, label: 'Create' },
                  { href: '/alerts', icon: Bell, label: 'Alerts' },
                  { href: '/profile', icon: UserCircle, label: 'Profile' },
                ].map(({ href, icon: Icon, label }) => {
                  const isActive = pathname === href;
                  return (
                    <button
                      key={href}
                      onClick={() => { onClose(); router.push(href); }}
                      className="flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-xl transition-all"
                      title={label}
                    >
                      <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all ${isActive ? 'bg-black/10 dark:bg-white/10' : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}>
                        <Icon
                          size={22}
                          strokeWidth={isActive ? 2.5 : 2}
                          className={isActive ? 'text-foreground' : 'text-zinc-500 dark:text-zinc-400'}
                          fill={isActive ? 'currentColor' : 'none'}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Shortcuts label */}
              <div className="px-4 pt-5 pb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Shortcuts</p>
              </div>

              {/* Alerts toggle */}
              <div className="mx-4 mb-2 px-4 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <Bell size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Alerts</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Push alerts</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAlertsEnabled(prev => !prev)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${alertsEnabled ? 'bg-black dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${alertsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              {/* Dark Mode toggle */}
              <div className="mx-4 mb-2 px-4 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                      {theme === 'dark'
                        ? <Moon size={18} className="text-indigo-500 dark:text-indigo-400" />
                        : <Sun size={18} className="text-indigo-600" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Dark Mode</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Use dark theme</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${theme === 'dark' ? 'bg-black dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              {/* Connect */}
              <button
                onClick={() => { onClose(); router.push('/connect'); }}
                className="mx-4 mb-2 w-[calc(100%-2rem)] px-4 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <UserPlus size={18} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Connect</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Find people to follow</p>
                </div>
              </button>

              {/* Stories */}
              <button
                onClick={() => { onClose(); router.push('/stories'); }}
                className="mx-4 mb-2 w-[calc(100%-2rem)] px-4 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center shrink-0">
                  <BookOpen size={18} className="text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Stories</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Browse &amp; share stories</p>
                </div>
              </button>

              {/* Messages */}
              <button
                onClick={() => { onClose(); router.push('/messages'); }}
                className="mx-4 mb-2 w-[calc(100%-2rem)] px-4 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <MessageCircle size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Messages</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Your conversations</p>
                </div>
              </button>

              {/* Settings & More */}
              <button
                onClick={() => { onClose(); router.push('/settings'); }}
                className="mx-4 mb-2 w-[calc(100%-2rem)] px-4 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                  <Settings size={18} className="text-zinc-600 dark:text-zinc-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Settings &amp; More</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">App preferences</p>
                </div>
              </button>

              {/* Log out */}
              <button
                onClick={handleLogout}
                className="mx-4 mb-6 w-[calc(100%-2rem)] px-4 py-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-950/40 transition-all text-left flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <LogOut size={18} className="text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400">Log out</p>
                  <p className="text-xs text-red-500/70 dark:text-red-400/50 mt-0.5">Exit your account</p>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
