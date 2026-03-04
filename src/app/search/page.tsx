'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Search as SearchIcon, 
  Settings2, 
  ArrowLeft, 
  X, 
  User, 
  MessageSquare, 
  Settings as SettingsIcon,
  Bell,
  Moon,
  Sun,
  UserX,
  Lock,
  LogOut,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { PostCard } from '@/components/PostCard';
import { Loader } from '@/components/ui/loader';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '@/components/VerifiedBadge';

type SearchType = 'Users' | 'Posts' | 'Settings';

const SETTINGS_ITEMS = [
  { label: 'Alerts', description: 'Push alerts', icon: Bell, path: '/settings' },
  { label: 'Dark Mode', description: 'Use dark theme', icon: Moon, path: '/settings' },
  { label: 'Blocked Users', description: 'Manage blocked accounts', icon: UserX, path: '/settings/blocked' },
  { label: 'Change Password', description: 'Update your password', icon: Lock, path: '/settings/password' },
  { label: 'Log out', description: 'Sign out of your account', icon: LogOut, path: '/settings' },
  { label: 'Delete Account', description: 'Permanently delete your account', icon: Trash2, path: '/settings' },
];

import { Suspense } from 'react';

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState<SearchType>('Users');
  const [results, setResults] = useState<{ users: any[], posts: any[], settings: any[] }>({
    users: [],
    posts: [],
    settings: []
  });
  const [loading, setLoading] = useState(false);
  const [isGesturing, setIsGesturing] = useState(false);

  const performSearch = useCallback(async (q: string, type: SearchType) => {
    if (!q.trim() || q.length < 2) {
      setResults(prev => ({ ...prev, users: [], posts: [], settings: [] }));
      return;
    }

    if (type === 'Settings') {
      const filteredSettings = SETTINGS_ITEMS.filter(item => 
        item.label.toLowerCase().includes(q.toLowerCase()) || 
        item.description.toLowerCase().includes(q.toLowerCase())
      );
      setResults(prev => ({ ...prev, settings: filteredSettings }));
      return;
    }

    setLoading(true);
    try {
      const apiType = type === 'Users' ? 'users' : 'posts';
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${apiType}`);
      const data = await res.json();
      
      if (type === 'Users') {
        setResults(prev => ({ ...prev, users: data.users || [] }));
      } else {
        setResults(prev => ({ ...prev, posts: data.posts || [] }));
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query, searchType);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchType, performSearch]);

  const handleBack = () => {
    router.back();
  };

  return (
    <motion.div 
      className="min-h-screen bg-white dark:bg-black text-black dark:text-white"
      style={{ touchAction: 'pan-y' }}
      onPanStart={() => setIsGesturing(true)}
      onPanEnd={(e, info) => {
        if (!isGesturing) return;
        setIsGesturing(false);

        const isHorizontal = Math.abs(info.offset.x) > Math.abs(info.offset.y);
        if (isHorizontal) {
          // Swipe left to right to go back
          if (info.offset.x > 50) {
            router.back();
          }
        }
      }}
    >
      {/* Top Bar - 64dp (h-16) */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 z-50 px-4 flex items-center gap-3">
        <div className="flex-1 relative flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-full px-3 h-12">
          <SearchIcon size={24} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${searchType}...`}
            className="flex-1 bg-transparent px-2 focus:outline-none text-sm h-full"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors shrink-0">
                <Settings2 size={24} strokeWidth={1.5} className="text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-2">
              {(['Users', 'Posts', 'Settings'] as SearchType[]).map((type) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => setSearchType(type)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors",
                    searchType === type 
                      ? "bg-black text-white dark:bg-white dark:text-black" 
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  {type === 'Users' && <User size={18} />}
                  {type === 'Posts' && <MessageSquare size={18} />}
                  {type === 'Settings' && <SettingsIcon size={18} />}
                  <span className="font-medium">{type}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="pt-20 px-4 pb-20 max-w-xl mx-auto">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-20"
            >
              <Loader />
            </motion.div>
          ) : query.length < 2 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-20 text-center text-zinc-500"
            >
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <SearchIcon size={24} strokeWidth={1.5} className="text-zinc-400" />
              </div>
              <p>Enter at least 2 characters to search</p>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {searchType === 'Users' && (
                <div className="space-y-4">
                  {results.users.length > 0 ? (
                    results.users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => router.push(`/user/${user.username}`)}
                        className="w-full flex items-center gap-4 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                      >
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0">
                          <img 
                            src={user.avatar_url ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.avatar_url}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name || 'User'}`} 
                            alt={user.full_name} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold truncate">{user.full_name}</span>
                            <VerifiedBadge username={user.username} />
                          </div>
                          <p className="text-sm text-zinc-500 truncate">@{user.username}</p>
                        </div>
                        <ChevronRight size={20} className="text-zinc-400" />
                      </button>
                    ))
                  ) : (
                    <div className="py-20 text-center text-zinc-500">No users found</div>
                  )}
                </div>
              )}

              {searchType === 'Posts' && (
                <div className="flex flex-col">
                  {results.posts.length > 0 ? (
                    results.posts.map((post) => (
                      <PostCard key={post.id} {...post} />
                    ))
                  ) : (
                    <div className="py-20 text-center text-zinc-500">No posts found</div>
                  )}
                </div>
              )}

              {searchType === 'Settings' && (
                <div className="space-y-2">
                  {results.settings.length > 0 ? (
                    results.settings.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => router.push(item.path)}
                        className="w-full flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl border border-black/5 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                            <item.icon size={24} strokeWidth={1.5} className="text-zinc-500 dark:text-zinc-400" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{item.label}</p>
                            <p className="text-sm text-zinc-500">{item.description}</p>
                          </div>
                        </div>
                        <ChevronRight size={24} strokeWidth={1.5} className="text-zinc-500" />
                      </button>
                    ))
                  ) : (
                    <div className="py-20 text-center text-zinc-500">No settings found</div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Loader />}>
      <SearchContent />
    </Suspense>
  );
}
