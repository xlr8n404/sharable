'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PostCard } from '@/components/PostCard';
import { BottomNav } from '@/components/BottomNav';
import { Settings2, Share2, MessageCircle, UserCircle, Plus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { MainMenu } from '@/components/MainMenu';
import { Loader } from '@/components/ui/loader';
import { PostSkeleton } from '@/components/PostSkeleton';
import { toast } from 'sonner';
import Link from 'next/link';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { sortByTrending } from '@/lib/trending';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useCache } from '@/providers/CacheProvider';

type UserPostStatus = {
  liked: Set<string>;
  reposted: Set<string>;
  saved: Set<string>;
};

const PAGE_SIZE = 10;
const TRENDING_FETCH_MULTIPLIER = 3;

type Post = {
  id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  user: { id: string; full_name: string; username: string; avatar_url: string | null; identity_tag?: string | null };
  user_id?: string;
  community?: { id: string; name: string };
  created_at: string;
  is_community_post?: boolean;
  isFollower?: boolean;
  [key: string]: unknown;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string;
  avatar_url: string | null;
  [key: string]: unknown;
};

type HomePageState = {
  posts: Post[];
  offset: number;
  hasMore: boolean;
  feedMode: 'explore' | 'following';
  profile: Profile | null;
  currentUser: { id: string } | null;
  currentUserProfile: { full_name: string; avatar_url: string; username?: string } | null;
  userPostStatus: UserPostStatus;
  followingIds: Set<string>;
};

export default function HomePage() {
  const router = useRouter();
  const cache = useCache();
  const pathname = usePathname();
  const isVisible = useScrollDirection();
  
  useScrollRestoration();

  const getCacheKey = (mode: string) => `home_page_state:${mode}`;
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [feedMode, setFeedMode] = useState<'explore' | 'following'>('explore');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ full_name: string; avatar_url: string; username?: string } | null>(null);
  const [userPostStatus, setUserPostStatus] = useState<UserPostStatus>({ liked: new Set(), reposted: new Set(), saved: new Set() });
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set([0, 1, 2]));
  const postRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const observer = useRef<IntersectionObserver | null>(null);
  const visibilityObserver = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const cacheKey = getCacheKey(feedMode);
    const cachedState = cache.getCached<HomePageState>(cacheKey);
    
    if (cachedState) {
      setPosts(cachedState.posts);
      setOffset(cachedState.offset);
      setHasMore(cachedState.hasMore);
      setProfile(cachedState.profile);
      setCurrentUser(cachedState.currentUser);
      setCurrentUserProfile(cachedState.currentUserProfile);
      setUserPostStatus(cachedState.userPostStatus);
      setFollowingIds(cachedState.followingIds);
      setLoading(false);
    }
  }, [feedMode, cache]);

  useEffect(() => {
    const cacheKey = getCacheKey(feedMode);
    const state: HomePageState = {
      posts,
      offset,
      hasMore,
      feedMode,
      profile,
      currentUser,
      currentUserProfile,
      userPostStatus,
      followingIds,
    };
    cache.setCached(cacheKey, state);
  }, [posts, offset, hasMore, feedMode, profile, currentUser, currentUserProfile, userPostStatus, followingIds, cache]);

  const handleDeletePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  useEffect(() => {
    visibilityObserver.current = new IntersectionObserver(
      (entries) => {
        setVisibleIndices(prev => {
          const next = new Set(prev);
          entries.forEach(entry => {
            const idx = parseInt((entry.target as HTMLElement).dataset.postIndex || '-1', 10);
            if (idx === -1) return;
            if (entry.isIntersecting) {
              next.add(idx);
            }
          });
          return next;
        });
      },
      { rootMargin: '200px 0px' }
    );

    postRefs.current.forEach((node) => {
      visibilityObserver.current?.observe(node);
    });

    return () => visibilityObserver.current?.disconnect();
  }, []);

  const fetchPosts = useCallback(async (currentOffset: number, mode: typeof feedMode, isLoadMore: boolean = false) => {
    if (!isLoadMore) setLoading(true);
    else setLoadingMore(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      if (!currentUser) setCurrentUser(user);

      if (user && !profile && !isLoadMore) {
        const [profileRes, followsRes, userProfileRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('follows').select('following_id').eq('follower_id', user.id),
          supabase.from('profiles').select('full_name, avatar_url, username').eq('id', user.id).maybeSingle(),
        ]);
        if (profileRes.data) setProfile(profileRes.data);
        if (userProfileRes.data) setCurrentUserProfile(userProfileRes.data);
        if (followsRes.data) {
          setFollowingIds(new Set(followsRes.data.map((f: any) => f.following_id)));
        }
      }

      let fetchedPosts: Post[] = [];

      if (mode === 'explore') {
        const fetchSize = PAGE_SIZE * TRENDING_FETCH_MULTIPLIER;
        const { data, error } = await supabase
          .from('posts')
          .select('*, user:profiles(id, full_name, avatar_url, username, identity_tag)')
          .order('created_at', { ascending: false })
          .range(currentOffset, currentOffset + fetchSize - 1);

        if (error) throw error;

        let mapped = (data || [])
          .filter((post: any) => post.user)
          .map((post: any) => {
            const urls = post.media_urls || (post.media_url ? [post.media_url] : []);
            const types = post.media_types || (post.media_type ? [post.media_type] : urls.map((u: string) => {
              if (/\.(mp4|webm|mov|avi)$/i.test(u) || u.includes('video')) return 'video';
              if (/\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(u) || u.includes('audio')) return 'audio';
              return 'image';
            }));
            return { ...post, media_urls: urls, media_types: types };
          });

        const { data: communityData } = await supabase
          .from('community_posts')
          .select(`
            *,
            user:profiles(id, full_name, username, avatar_url, identity_tag),
            community:communities(id, name),
            likes:community_post_likes(count),
            comments:community_post_comments(count)
          `)
          .order('created_at', { ascending: false })
          .range(currentOffset, currentOffset + (fetchSize - 1));

        if (communityData) {
          const formattedCommunityPosts = communityData.filter((post: any) => post.user).map((post: any) => {
            const urls = post.media_urls || (post.media_url ? [post.media_url] : []);
            const types = post.media_types || (post.media_type ? [post.media_type] : urls.map((u: string) => {
              if (/\.(mp4|webm|mov|avi)$/i.test(u) || u.includes('video')) return 'video';
              if (/\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(u) || u.includes('audio')) return 'audio';
              return 'image';
            }));
            return { ...post, media_urls: urls, media_types: types, is_community_post: true };
          });
          mapped = [...mapped, ...formattedCommunityPosts];
        }

        fetchedPosts = sortByTrending(mapped).slice(0, PAGE_SIZE);
      } else if (mode === 'following') {
        let query = supabase
          .from('posts')
          .select('*, user:profiles(id, full_name, avatar_url, username, identity_tag)');

        if (!user) {
          query = query.order('created_at', { ascending: false });
        } else {
          const { data: followsData, error: followsError } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', user.id);

          if (followsError) throw followsError;

          const followingIds = (followsData || []).map(f => f.following_id);
          query = query
            .in('user_id', [...followingIds, user.id])
            .order('created_at', { ascending: false });
        }

        query = query.range(currentOffset, currentOffset + PAGE_SIZE - 1);
        const { data, error } = await query;
        if (error) throw error;
        fetchedPosts = (data || [])
          .filter((post: any) => post.user)
          .map((post: any) => {
            const urls = post.media_urls || (post.media_url ? [post.media_url] : []);
            const types = post.media_types || (post.media_type ? [post.media_type] : urls.map((u: string) => {
              if (/\.(mp4|webm|mov|avi)$/i.test(u) || u.includes('video')) return 'video';
              if (/\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(u) || u.includes('audio')) return 'audio';
              return 'image';
            }));
            return { ...post, media_urls: urls, media_types: types };
          });

        const { data: communityData } = await supabase
          .from('community_posts')
          .select(`
            *,
            user:profiles(id, full_name, username, avatar_url, identity_tag),
            community:communities(id, name),
            likes:community_post_likes(count),
            comments:community_post_comments(count)
          `)
          .order('created_at', { ascending: false });

        if (communityData) {
          const { data: followsData } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', user?.id);

          const followingIds = (followsData || []).map(f => f.following_id);
          const formattedCommunityPosts = communityData
            .filter((post: any) => post.user && (followingIds.includes(post.user_id) || post.user_id === user?.id))
            .map((post: any) => {
              const urls = post.media_urls || (post.media_url ? [post.media_url] : []);
              const types = post.media_types || (post.media_type ? [post.media_type] : urls.map((u: string) => {
                if (/\.(mp4|webm|mov|avi)$/i.test(u) || u.includes('video')) return 'video';
                if (/\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(u) || u.includes('audio')) return 'audio';
                return 'image';
              }));
              return { ...post, media_urls: urls, media_types: types, is_community_post: true };
            });
          fetchedPosts = [...fetchedPosts, ...formattedCommunityPosts]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, PAGE_SIZE);
        }
      }

      if (isLoadMore) {
        setPosts(prev => [...prev, ...fetchedPosts]);
      } else {
        setPosts(fetchedPosts);
      }

      setHasMore(fetchedPosts.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentUser, profile]);

  useEffect(() => {
    if (posts.length === 0) {
      fetchPosts(0, feedMode, false);
    }
  }, [feedMode, posts.length, fetchPosts]);

  const handleLoadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      const newOffset = offset + PAGE_SIZE;
      setOffset(newOffset);
      fetchPosts(newOffset, feedMode, true);
    }
  }, [loading, loadingMore, hasMore, offset, feedMode, fetchPosts]);

  const lastPostRef = useCallback((node: HTMLDivElement | null) => {
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
        handleLoadMore();
      }
    });

    if (node) observer.current.observe(node);
  }, [hasMore, loading, loadingMore, handleLoadMore]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 h-16">
          <button
            onClick={() => setMainMenuOpen(true)}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <Settings2 size={24} strokeWidth={1.5} className="text-zinc-500" />
          </button>
          <div className="flex items-center gap-2">
            <Share2 size={24} strokeWidth={2} className="text-primary" />
          </div>
          <button
            onClick={() => router.push('/messages')}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <MessageCircle size={24} strokeWidth={1.5} className="text-zinc-500" />
          </button>
        </div>

        {/* Post create shortcut */}
        <div className="h-16 flex items-center gap-3 px-4 border-t border-border">
          <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
            {currentUserProfile?.avatar_url ? (
              <img src={currentUserProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <UserCircle size={28} strokeWidth={1} className="text-zinc-500 dark:text-zinc-400" />
            )}
          </div>
          <Link
            href="/create/post"
            className="flex-1 flex items-center justify-between h-11 bg-zinc-100 dark:bg-zinc-900 rounded-full px-4 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
          >
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate">Anything sharable today?</span>
            <Plus size={18} className="text-zinc-500 dark:text-zinc-400 shrink-0 ml-2" />
          </Link>
        </div>

        {mainMenuOpen && (
          <MainMenu 
            open={mainMenuOpen} 
            onClose={() => setMainMenuOpen(false)} 
            avatarSrc={currentUserProfile?.avatar_url || null} 
            feedMode={feedMode} 
            onFeedModeChange={(mode) => {
              if (mode === 'explore' || mode === 'following') {
                setFeedMode(mode);
                setOffset(0);
                setPosts([]);
              }
            }} 
          />
        )}
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full">
        <div className="divide-y divide-border">
          {posts.map((post, index) => (
            <div
              key={post.id}
              data-post-index={index}
              ref={(node) => {
                if (index === posts.length - 1) lastPostRef(node);
                if (node) {
                  postRefs.current.set(index, node);
                  visibilityObserver.current?.observe(node);
                } else {
                  postRefs.current.delete(index);
                }
              }}
            >
              <PostCard
                {...post}
                onDelete={handleDeletePost}
                avatarSize={40}
                isFollower={post.user_id ? followingIds.has(post.user_id) : false}
                currentUserId={currentUser?.id ?? null}
                currentUserProfile={currentUserProfile}
                initialLiked={userPostStatus.liked.has(post.id)}
                initialReposted={userPostStatus.reposted.has(post.id)}
                initialSaved={userPostStatus.saved.has(post.id)}
                isVisible={visibleIndices.has(index)}
              />
            </div>
          ))}
        </div>

        {loading && (
          <div className="flex flex-col">
            {[...Array(5)].map((_, i) => (
              <PostSkeleton key={`skeleton-${i}`} />
            ))}
          </div>
        )}

        {!loading && loadingMore && (
          <div className="py-4">
            <Loader />
          </div>
        )}

        {!loading && !loadingMore && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📭</span>
            </div>
            <h3 className="text-xl font-bold mb-2">No posts yet</h3>
            <p className="text-zinc-500 max-w-[240px]">Be the first to share something with the world!</p>
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="py-12 text-center text-zinc-500 text-sm font-medium">
            You're all caught up!
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
