'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { supabase } from '@/lib/supabase';
import { Search, MessageCircle, X, Menu, Settings, LogOut, Share2 } from 'lucide-react';
import { Loader } from '@/components/ui/loader';

interface UserCard {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  posts_count: number;
  followers_count: number;
  following_count: number;
}

const SUPABASE_STORAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;

function getAvatarSrc(avatar_url: string | null, full_name: string | null) {
  if (avatar_url) return `${SUPABASE_STORAGE}/avatars/${avatar_url}`;
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${full_name || 'default'}`;
}

function getCoverSrc(cover_url: string | null) {
  if (cover_url) return `${SUPABASE_STORAGE}/covers/${cover_url}`;
  return null;
}

export default function ConnectPage() {
  const isHeaderVisible = useScrollDirection();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserCard[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggested, setLoadingSuggested] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);
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

  async function enrichUsers(rawUsers: any[], userId: string): Promise<UserCard[]> {
    const enriched: UserCard[] = await Promise.all(
      rawUsers.map(async (u: any) => {
        const [countsRes, postsRes] = await Promise.all([
          fetch(`/api/follow?user_id=${u.id}`),
          supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', u.id),
        ]);
        const counts = await countsRes.json();
        return {
          id: u.id,
          full_name: u.full_name,
          username: u.username,
          avatar_url: u.avatar_url,
          cover_url: u.cover_url || null,
          bio: u.bio,
          posts_count: postsRes.count || 0,
          followers_count: counts.followers_count || 0,
          following_count: counts.following_count || 0,
        };
      })
    );
    return enriched;
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const res = await fetch(`/api/follow?user_id=${user.id}&type=following`);
        const data = await res.json();
        if (data.data) {
          const ids = new Set<string>(data.data.map((f: any) => f.following_id));
          setFollowingIds(ids);
        }

        const { data: allUsers } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, cover_url, bio')
          .neq('id', user.id)
          .limit(20);

        if (allUsers && allUsers.length > 0) {
          const enriched = await enrichUsers(allUsers, user.id);
          setSuggestedUsers(enriched);
        }
      }
      setLoadingSuggested(false);
    }
    init();
  }, []);

  const searchUsers = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&type=users`);
      const data = await res.json();
      const filtered = (data.users || []).filter((u: any) => u.id !== currentUserId);

      if (filtered.length > 0 && currentUserId) {
        const enriched = await enrichUsers(filtered, currentUserId);
        setUsers(enriched);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchUsers(query);
    }, 300);
    return () => clearTimeout(debounce);
  }, [query, searchUsers]);

  const handleFollow = async (userId: string) => {
    if (!currentUserId) return;
    setLoadingFollow(userId);

    try {
      const isFollowing = followingIds.has(userId);

      if (isFollowing) {
        await fetch('/api/follow', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ follower_id: currentUserId, following_id: userId }),
        });
        setFollowingIds(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
        setSuggestedUsers(prev => prev.map(u => u.id === userId ? { ...u, followers_count: Math.max(0, u.followers_count - 1) } : u));
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, followers_count: Math.max(0, u.followers_count - 1) } : u));
      } else {
        await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ follower_id: currentUserId, following_id: userId }),
        });
        setFollowingIds(prev => new Set(prev).add(userId));
        setSuggestedUsers(prev => prev.map(u => u.id === userId ? { ...u, followers_count: u.followers_count + 1 } : u));
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, followers_count: u.followers_count + 1 } : u));
      }
    } catch (error) {
      console.error('Follow error:', error);
    } finally {
      setLoadingFollow(null);
    }
  };

  const displayUsers = query.length >= 2 ? users : suggestedUsers;
  const isSearching = query.length >= 2;

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-black/[0.08] dark:border-white/[0.08] transition-transform duration-300">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center gap-4">
          <span className="font-bold text-[22px] tracking-tight font-[family-name:var(--font-syne)] flex-shrink-0">
            Search
          </span>
          <div className="flex-1 relative">
            <Search size={20} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full pl-10 pr-8 py-2 text-black dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-700 transition-colors text-sm"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            )}
          </div>
          <button 
            onClick={() => setMenuOpen(true)}
            className="p-2 -mr-2 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
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

      <main className="max-w-xl mx-auto px-4 py-4 pb-24">
        {loading || loadingSuggested ? (
          <Loader />
        ) : displayUsers.length > 0 ? (
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4 px-1">
              {isSearching ? 'Search Results' : 'Suggested for you'}
            </p>
            <div className="space-y-6">
              {displayUsers.map((user) => {
                const coverSrc = getCoverSrc(user.cover_url);
                const avatarSrc = getAvatarSrc(user.avatar_url, user.full_name);
                const isFollowed = followingIds.has(user.id);

                return (
                  <div
                    key={user.id}
                    className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden bg-white dark:bg-zinc-950 shadow-sm"
                  >
                    <div className="relative">
                      <button
                        onClick={() => router.push(`/user/${user.username}`)}
                        className="w-full block"
                      >
                        <div className="w-full h-36 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                          {coverSrc ? (
                            <img
                              src={coverSrc}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-zinc-200 dark:from-zinc-800 to-zinc-300 dark:to-zinc-900" />
                          )}
                        </div>
                      </button>

                      <div className="absolute right-4 -bottom-5 flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/user/${user.username}`)}
                            className="p-2.5 bg-zinc-100 dark:bg-zinc-900 rounded-full border border-black/10 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors shadow-sm"
                          >
                            <MessageCircle size={24} strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => handleFollow(user.id)}
                            disabled={loadingFollow === user.id}
                            className={`px-6 py-2.5 font-bold text-sm rounded-full transition-colors shadow-sm disabled:opacity-50 ${
                              isFollowed
                                ? 'bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white border border-black/10 dark:border-white/10 hover:bg-red-50 dark:hover:bg-red-900/50 hover:border-red-500/50 hover:text-red-500'
                                : 'bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200'
                            }`}
                            >
                              {loadingFollow === user.id ? (
                                <Loader centered={false} className="text-current" />
                              ) : isFollowed ? 'Following' : 'Follow'}
                            </button>

                      </div>
                    </div>

                    <div className="relative px-4 pb-6">
                      <div className="flex items-end justify-between -mt-12">
                        <button
                          onClick={() => router.push(`/user/${user.username}`)}
                          className="flex-shrink-0"
                        >
                          <div className="w-24 h-24 rounded-full border-4 border-white dark:border-zinc-950 overflow-hidden bg-zinc-100 dark:bg-zinc-900 shadow-md">
                            <img
                              src={avatarSrc}
                              alt={user.full_name}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=default`; }}
                            />
                          </div>
                        </button>
                      </div>

                          <button
                            onClick={() => router.push(`/user/${user.username}`)}
                            className="w-full text-left mt-4"
                          >
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-bold leading-tight">{user.full_name || user.username}</h3>
                              <VerifiedBadge username={user.username} />
                            </div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">@{user.username}</p>
                          </button>


                      <div className="flex items-center gap-4 mt-4">
                        <div className="text-center">
                          <span className="font-bold">{user.posts_count}</span>
                          <span className="text-zinc-500 text-sm ml-1">Posts</span>
                        </div>
                        <div className="text-center">
                          <span className="font-bold">{user.followers_count}</span>
                          <span className="text-zinc-500 text-sm ml-1">Followers</span>
                        </div>
                        <div className="text-center">
                          <span className="font-bold">{user.following_count}</span>
                          <span className="text-zinc-500 text-sm ml-1">Following</span>
                        </div>
                      </div>

                      {user.bio && (
                        <p className="text-zinc-700 dark:text-zinc-300 text-[15px] mt-4 line-clamp-2 leading-relaxed">{user.bio}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isSearching ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <Search size={24} strokeWidth={1.5} className="text-zinc-400 dark:text-zinc-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">No users found</h3>
            <p className="text-zinc-500 max-w-[280px]">
              Try a different search term
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <Search size={24} strokeWidth={1.5} className="text-zinc-400 dark:text-zinc-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Find People</h3>
            <p className="text-zinc-500 max-w-[280px]">
              Search for people to connect with on Sharable
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
