'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { supabase } from '@/lib/supabase';
import { Search, X, UserCircle } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface UserCard {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  description: string | null;
  account_type: string | null;
  posts_count: number;
  followers_count: number;
  following_count: number;
}

function getAvatarSrc(avatar_url: string | null, full_name: string | null) {
  if (avatar_url) {
    if (avatar_url.startsWith('http')) {
      const match = avatar_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
      if (match) return `/api/media/${match[1]}/${match[2]}`;
    }
    return `/api/media/avatars/${avatar_url}`;
  }
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${full_name || 'default'}`;
}

function getCoverSrc(cover_url: string | null) {
  if (cover_url) {
    if (cover_url.startsWith('http')) {
      const match = cover_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
      if (match) return `/api/media/${match[1]}/${match[2]}`;
    }
    return `/api/media/covers/${cover_url}`;
  }
  return null;
}

export default function ConnectPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserCard[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggested, setLoadingSuggested] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);

  async function enrichUsers(rawUsers: any[]): Promise<UserCard[]> {
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
          bio: u.bio || null,
          description: u.description || null,
          account_type: u.account_type || null,
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
          .select('id, full_name, username, avatar_url, cover_url, bio, description, account_type')
          .neq('id', user.id)
          .limit(20);

        if (allUsers && allUsers.length > 0) {
          const enriched = await enrichUsers(allUsers);
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

      if (filtered.length > 0) {
        const enriched = await enrichUsers(filtered);
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
        setFollowingIds(prev => { const next = new Set(prev); next.delete(userId); return next; });
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

  const handleMessage = async (userId: string) => {
    if (!currentUserId) {
      toast.error('Please login to message');
      return;
    }
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user1_id: currentUserId, user2_id: userId }),
      });
      if (res.ok) {
        router.push('/messages');
      } else {
        toast.error('Failed to start conversation');
      }
    } catch {
      toast.error('Something went wrong');
    }
  };

  const displayUsers = query.length >= 2 ? users : suggestedUsers;
  const isSearching = query.length >= 2;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar: "Connect" title + search bar */}
      <header className="sticky top-0 z-50 bg-background">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center gap-3">
          <span className="font-bold text-2xl tracking-tight font-[family-name:var(--font-syne)] flex-shrink-0">
            Connect
          </span>
          <div className="flex-1 relative">
            <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full pl-9 pr-8 py-2 text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-700 transition-colors text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-4 pb-24">
        {loading || loadingSuggested ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden animate-pulse">
                <Skeleton className="h-[120px] w-full bg-zinc-100 dark:bg-zinc-900" />
                <div className="px-4 pt-3 pb-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-20 h-20 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0 -mt-12 border-4 border-white dark:border-black" />
                    <div className="flex-1 space-y-1.5 pt-2">
                      <Skeleton className="h-4 w-1/3 bg-zinc-100 dark:bg-zinc-900" />
                      <Skeleton className="h-3 w-1/4 bg-zinc-50 dark:bg-zinc-950" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-3/4 bg-zinc-100 dark:bg-zinc-900" />
                  <div className="flex gap-3">
                    <Skeleton className="h-9 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-900" />
                    <Skeleton className="h-9 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : displayUsers.length > 0 ? (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider px-1">
              {isSearching ? 'Search Results' : 'Suggested for you'}
            </p>
            {displayUsers.map((user) => {
              const coverSrc = getCoverSrc(user.cover_url);
              const avatarSrc = getAvatarSrc(user.avatar_url, user.full_name);
              const isFollowed = followingIds.has(user.id);
              const blurb = user.account_type === 'brand' ? user.description : user.bio;

              return (
                <div
                  key={user.id}
                  className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden bg-white dark:bg-zinc-950 shadow-sm"
                >
                  {/* Cover: width auto, height 120px */}
                  <div
                    className="w-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden cursor-pointer"
                    style={{ height: '120px' }}
                    onClick={() => router.push(`/${user.username}`)}
                  >
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

                  <div className="px-4 pb-5">
                    {/* Avatar 80px — overlapping cover */}
                    <div
                      className="w-20 h-20 rounded-full border-4 border-white dark:border-zinc-950 overflow-hidden bg-zinc-100 dark:bg-zinc-900 -mt-10 mb-3 cursor-pointer shadow-sm"
                      onClick={() => router.push(`/${user.username}`)}
                    >
                      {user.avatar_url ? (
                        <img
                          src={avatarSrc}
                          alt={user.full_name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=default`; }}
                        />
                      ) : (
                        <UserCircle className="w-full h-full text-zinc-400 dark:text-zinc-600" strokeWidth={1} />
                      )}
                    </div>

                    {/* Full name + username */}
                    <div
                      className="cursor-pointer"
                      onClick={() => router.push(`/${user.username}`)}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-base font-bold leading-tight">{user.full_name || user.username}</h3>
                        <VerifiedBadge username={user.username} />
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">@{user.username}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3">
                      <div>
                        <span className="font-bold text-sm">{user.posts_count}</span>
                        <span className="text-zinc-500 text-xs ml-1">Posts</span>
                      </div>
                      <div>
                        <span className="font-bold text-sm">{user.followers_count}</span>
                        <span className="text-zinc-500 text-xs ml-1">Followers</span>
                      </div>
                      <div>
                        <span className="font-bold text-sm">{user.following_count}</span>
                        <span className="text-zinc-500 text-xs ml-1">Following</span>
                      </div>
                    </div>

                    {/* Bio / Description */}
                    {blurb && (
                      <p className="text-zinc-700 dark:text-zinc-300 text-[14px] mt-3 line-clamp-2 leading-relaxed">
                        {blurb}
                      </p>
                    )}

                    {/* Message + Follow buttons */}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleMessage(user.id)}
                        className="flex-1 py-2 font-bold text-sm rounded-full bg-zinc-100 dark:bg-zinc-900 text-foreground border border-black/10 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Message
                      </button>
                      <button
                        onClick={() => handleFollow(user.id)}
                        disabled={loadingFollow === user.id}
                        className={`flex-1 py-2 font-bold text-sm rounded-full transition-colors disabled:opacity-50 flex items-center justify-center ${
                          isFollowed
                            ? 'bg-zinc-100 dark:bg-zinc-900 text-foreground border border-black/10 dark:border-white/10 hover:bg-red-50 dark:hover:bg-red-900/50 hover:border-red-500/50 hover:text-red-500'
                            : 'bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200'
                        }`}
                      >
                        {loadingFollow === user.id ? (
                          <Loader centered={false} className="text-current" />
                        ) : isFollowed ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : isSearching ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <Search size={24} strokeWidth={1.5} className="text-zinc-400 dark:text-zinc-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">No users found</h3>
            <p className="text-zinc-500 max-w-[280px]">Try a different search term</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <Search size={24} strokeWidth={1.5} className="text-zinc-400 dark:text-zinc-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Find People</h3>
            <p className="text-zinc-500 max-w-[280px]">Search for people to connect with on Sharable</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
