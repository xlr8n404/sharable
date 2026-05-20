'use client';
import { useNavBack } from '@/components/NavigationHistoryProvider';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search as SearchIcon,
  Settings2,
  X,
  CircleUser,
  FileText,
  Hash,
  Settings as SettingsIcon,
  Bell,
  Moon,
  UserX,
  Lock,
  LogOut,
  Trash2,
  ChevronRight,
  Users,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { PostCard } from '@/components/PostCard';
import CommunityCard from '@/components/CommunityCard';
import { Loader } from '@/components/ui/loader';
import { PostSkeleton } from '@/components/PostSkeleton';
import { CommunitySkeleton } from '@/components/CommunitySkeleton';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { BottomNav } from '@/components/BottomNav';

type SearchType = 'Posts' | 'Stories' | 'Users' | 'Communities' | 'Hashtags' | 'Settings' | null;

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
  const { goBack } = useNavBack();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState<SearchType>(null);
  const [results, setResults] = useState<{ users: any[], posts: any[], stories: any[], hashtags: any[], communities: any[], settings: any[] }>({
    users: [],
    posts: [],
    stories: [],
    hashtags: [],
    communities: [],
    settings: []
  });
  const [loading, setLoading] = useState(false);
  const [isGesturing, setIsGesturing] = useState(false);
  const [showFilterPills, setShowFilterPills] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const loadRandomContent = useCallback(async (type: SearchType) => {
    setLoading(true);
    try {
      if (type === null) {
        // Load all random content
        const res = await fetch(`/api/search?random=true`);
        const data = await res.json();
        setResults({
          posts: data.posts || [],
          users: data.users || [],
          stories: [],
          hashtags: data.hashtags || [],
          communities: data.communities || [],
          settings: [],
        });
      } else if (type === 'Posts') {
        const res = await fetch(`/api/search?random=true&type=posts`);
        const data = await res.json();
        setResults(prev => ({ ...prev, posts: data.posts || [] }));
      } else if (type === 'Stories') {
        const res = await fetch(`/api/search?random=true&type=stories`);
        const data = await res.json();
        setResults(prev => ({ ...prev, stories: data.stories || [] }));
      } else if (type === 'Users') {
        const res = await fetch(`/api/search?random=true&type=users`);
        const data = await res.json();
        setResults(prev => ({ ...prev, users: data.users || [] }));
      } else if (type === 'Communities') {
        const res = await fetch(`/api/search?random=true&type=communities`);
        const data = await res.json();
        setResults(prev => ({ ...prev, communities: data.communities || [] }));
      } else if (type === 'Hashtags') {
        const res = await fetch(`/api/search?random=true&type=posts`);
        const data = await res.json();
        setResults(prev => ({ ...prev, hashtags: data.posts || [] }));
      }
    } catch (error) {
      console.error('Error loading random content:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const performSearch = useCallback(async (q: string, type: SearchType) => {
    if (!q.trim() || q.length < 2) {
      setResults({ users: [], posts: [], stories: [], hashtags: [], communities: [], settings: [] });
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
      if (type === null) {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=all`);
        const data = await res.json();
        setResults({
          posts: data.posts || [],
          users: data.users || [],
          communities: data.communities || [],
          hashtags: data.posts || [],
          stories: [],
          settings: [],
        });
      } else {
        const apiType =
          type === 'Users' ? 'users' :
          type === 'Communities' ? 'communities' :
          type === 'Stories' ? 'stories' : 'posts';
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${apiType}`);
        const data = await res.json();

        if (type === 'Users') {
          setResults(prev => ({ ...prev, users: data.users || [] }));
        } else if (type === 'Posts') {
          setResults(prev => ({ ...prev, posts: data.posts || [] }));
        } else if (type === 'Stories') {
          setResults(prev => ({ ...prev, stories: data.stories || [] }));
        } else if (type === 'Communities') {
          setResults(prev => ({ ...prev, communities: data.communities || [] }));
        } else if (type === 'Hashtags') {
          const res2 = await fetch(`/api/search?q=${encodeURIComponent('#' + q.replace(/^#/, ''))}&type=posts`);
          const data2 = await res2.json();
          setResults(prev => ({ ...prev, hashtags: data2.posts || [] }));
        }
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initialize with random content on first load
    if (!hasInitialized && !initialQuery) {
      loadRandomContent(null);
      setHasInitialized(true);
      return;
    }

    const timer = setTimeout(() => {
      if (query.length < 2) {
        // If query is cleared, load random content again
        if (searchType !== 'Settings') {
          loadRandomContent(searchType);
        }
      } else {
        performSearch(query, searchType);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchType, performSearch, loadRandomContent, hasInitialized, initialQuery]);

  const filterPills: { type: SearchType; icon: React.ElementType; label: string }[] = [
    { type: 'Posts', icon: FileText, label: 'Posts' },
    { type: 'Stories', icon: BookOpen, label: 'Stories' },
    { type: 'Users', icon: CircleUser, label: 'Users' },
    { type: 'Communities', icon: Users, label: 'Communities' },
    { type: 'Hashtags', icon: Hash, label: 'Hashtags' },
    { type: 'Settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <motion.div 
      className="min-h-screen bg-background text-foreground"
      style={{ touchAction: 'pan-y' }}
      onPanStart={() => setIsGesturing(true)}
      onPanEnd={(e, info) => {
        if (!isGesturing) return;
        setIsGesturing(false);
        const isHorizontal = Math.abs(info.offset.x) > Math.abs(info.offset.y);
        if (isHorizontal && info.offset.x > 50) {
          goBack();
        }
      }}
    >
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background">
        <div className="h-16 px-4 flex items-center gap-3">
          <div className="flex-1 relative flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-full px-3 h-12">
            <SearchIcon size={24} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchType ? `Search ${searchType}...` : 'Search Sharable'}
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
            <button
              onClick={() => setShowFilterPills(p => !p)}
              className={cn(
                "p-1 rounded-full transition-colors shrink-0",
                showFilterPills
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400"
              )}
            >
              <Settings2 size={24} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <AnimatePresence>
          {showFilterPills && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 pb-3 pt-1 overflow-x-auto no-scrollbar">
                {filterPills.map(({ type, icon: Icon, label }) => {
                  const isActive = searchType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setSearchType(prev => prev === type ? null : type)}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all whitespace-nowrap",
                        isActive
                          ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                          : "bg-transparent text-zinc-600 border-zinc-200 dark:text-zinc-400 dark:border-zinc-700 hover:border-black dark:hover:border-white"
                      )}
                    >
                      <Icon size={16} strokeWidth={1.75} />
                      {label && <span>{label}</span>}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="pt-20 px-4 pb-24 max-w-xl mx-auto">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {searchType === 'Communities' ? (
                [...Array(6)].map((_, i) => <CommunitySkeleton key={i} />)
              ) : searchType === 'Users' ? (
                [...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 animate-pulse">
                    <div className="w-14 h-14 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-muted rounded" />
                      <div className="h-3 w-20 bg-muted rounded" />
                    </div>
                  </div>
                ))
              ) : (
                [...Array(5)].map((_, i) => <PostSkeleton key={i} />)
              )}
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Users */}
              {(searchType === 'Users' || searchType === null) && results.users.length > 0 && (
                <div className="space-y-3">
                  {searchType === null && (
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-500 uppercase tracking-wider px-1">
                      <CircleUser size={14} strokeWidth={2} /> Users
                    </div>
                  )}
                  <div className="space-y-2">
                    {results.users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => router.push(`/${user.username}`)}
                        className="w-full flex items-center gap-4 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                      >
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0">
                          <img
                            src={user.avatar_url ? `/api/media/avatars/${user.avatar_url}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name || 'User'}`}
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
                    ))}
                  </div>
                </div>
              )}
              {searchType === 'Users' && results.users.length === 0 && (
                <div className="py-20 text-center text-zinc-500">No users found</div>
              )}

              {/* Communities */}
              {(searchType === 'Communities' || searchType === null) && results.communities.length > 0 && (
                <div className="space-y-3">
                  {searchType === null && (
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-500 uppercase tracking-wider px-1">
                      <Users size={14} strokeWidth={2} /> Communities
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4">
                    {results.communities.map((community) => (
                      <CommunityCard key={community.id} community={community} />
                    ))}
                  </div>
                </div>
              )}
              {searchType === 'Communities' && results.communities.length === 0 && (
                <div className="py-20 text-center text-zinc-500">No communities found</div>
              )}

              {/* Posts */}
              {(searchType === 'Posts' || searchType === null) && results.posts.length > 0 && (
                <div>
                  {searchType === null && (
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-500 uppercase tracking-wider px-1 mb-3">
                      <FileText size={14} strokeWidth={2} /> Posts
                    </div>
                  )}
                  <div className="flex flex-col">
                    {results.posts.map((post) => (
                      <PostCard key={post.id} {...post} />
                    ))}
                  </div>
                </div>
              )}
              {searchType === 'Posts' && results.posts.length === 0 && (
                <div className="py-20 text-center text-zinc-500">No posts found</div>
              )}

              {/* Stories */}
              {(searchType === 'Stories' || searchType === null) && results.stories.length > 0 && (
                <div>
                  {searchType === null && (
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-500 uppercase tracking-wider px-1 mb-3">
                      <BookOpen size={14} strokeWidth={2} /> Stories
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {results.stories.map((story: any) => {
                      const photoUrl = story.photo_url
                        ? (story.photo_url.startsWith('/api/') ? story.photo_url : `/api/media/stories/${story.photo_url}`)
                        : null;
                      const avatarUrl = story.user?.avatar_url
                        ? `/api/media/avatars/${story.user.avatar_url}`
                        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${story.user?.full_name || 'User'}`;
                      return (
                        <button
                          key={story.id}
                          onClick={() => router.push(`/create/story/view?id=${story.id}`)}
                          className="relative rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 aspect-[9/16] text-left hover:opacity-90 transition-opacity"
                        >
                          {photoUrl ? (
                            <img src={photoUrl} alt={story.caption || 'Story'} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-700">
                              <BookOpen size={32} className="text-zinc-400" />
                            </div>
                          )}
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                          {/* Top: avatar + name */}
                          <div className="absolute top-2 left-2 flex items-center gap-1.5">
                            <img src={avatarUrl} alt={story.user?.full_name} className="w-7 h-7 rounded-full object-cover border-2 border-white" />
                            <span className="text-white text-xs font-semibold truncate max-w-[80px] drop-shadow">{story.user?.username || story.user?.full_name}</span>
                          </div>
                          {/* Bottom: caption */}
                          {story.caption && (
                            <div className="absolute bottom-2 left-2 right-2">
                              <p className="text-white text-xs line-clamp-2 drop-shadow">{story.caption}</p>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {searchType === 'Stories' && results.stories.length === 0 && !loading && (
                <div className="py-20 text-center text-zinc-500">No stories found</div>
              )}

              {/* Hashtags */}
              {(searchType === 'Hashtags' || searchType === null) && results.hashtags.length > 0 && (
                <div className="px-4">
                  {searchType === null && (
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-500 uppercase tracking-wider px-1 mb-3">
                      <Hash size={14} strokeWidth={2} /> Hashtags
                    </div>
                  )}
                  <div className="flex flex-col">
                    {results.hashtags.map((post) => (
                      <PostCard key={post.id} {...post} />
                    ))}
                  </div>
                </div>
              )}
              {searchType === 'Hashtags' && results.hashtags.length === 0 && (
                <div className="py-20 text-center text-zinc-500">No hashtags found</div>
              )}

              {/* Settings */}
              {searchType === 'Settings' && (
                <div className="space-y-2">
                  {results.settings.length > 0 ? (
                    results.settings.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => router.push(item.path)}
                        className="w-full flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                          <item.icon size={20} className="text-zinc-600 dark:text-zinc-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-bold block">{item.label}</span>
                          <p className="text-sm text-zinc-500 truncate">{item.description}</p>
                        </div>
                        <ChevronRight size={20} className="text-zinc-400" />
                      </button>
                    ))
                  ) : (
                    <div className="py-20 text-center text-zinc-500">No settings found</div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {query.length >= 2 &&
               results.users.length === 0 &&
               results.posts.length === 0 &&
               results.stories.length === 0 &&
               results.hashtags.length === 0 &&
               results.communities.length === 0 &&
               results.settings.length === 0 && (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <SearchIcon size={24} className="text-zinc-400" />
                  </div>
                  <h3 className="font-bold text-lg mb-1">No results for "{query}"</h3>
                  <p className="text-zinc-500">Try searching for something else</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </motion.div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader /></div>}>
      <SearchContent />
    </Suspense>
  );
}
