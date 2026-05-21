'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PostCard } from '@/components/PostCard';
import { BottomNav } from '@/components/BottomNav';
import { Share2, MessageCircle, Settings2, UserCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { MainMenu } from '@/components/MainMenu';
import { Loader } from '@/components/ui/loader';
import { PostSkeleton } from '@/components/PostSkeleton';
import { toast } from 'sonner';
import Link from 'next/link';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { sortByTrending } from '@/lib/trending';

type UserPostStatus = {
  liked: Set<string>;
  reposted: Set<string>;
  saved: Set<string>;
};

const PAGE_SIZE = 10;
// For trending mode we fetch a larger pool per page so the algorithm has
// enough candidates to score and sort before slicing to PAGE_SIZE.
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

export default function HomePage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [feedMode, setFeedMode] = useState<'trending' | 'explore' | 'following' | 'sharable' | 'communities'>('explore');
  const [pinnedFeed, setPinnedFeed] = useState<'explore' | 'following'>('explore');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ full_name: string; avatar_url: string; username?: string } | null>(null);
  const [userPostStatus, setUserPostStatus] = useState<UserPostStatus>({ liked: new Set(), reposted: new Set(), saved: new Set() });
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  // Track which post indices are visible (for lazy video loading)
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set([0, 1, 2]));
  const postRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pathname = usePathname();
  const isVisible = useScrollDirection();

  const observer = useRef<IntersectionObserver | null>(null);
  const visibilityObserver = useRef<IntersectionObserver | null>(null);

  const handleDeletePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  // Set up visibility observer for lazy media loading
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
            // Keep as visible once seen — don't unload loaded media
          });
          return next;
        });
      },
      { rootMargin: '200px 0px' } // preload 200px before entering viewport
    );

    // Observe already mounted post nodes
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

      // Store current user once
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

        if (mode === 'communities') {
          // Fetch user's community posts
          if (!user) {
            setHasMore(false);
            fetchedPosts = [];
          } else {
            // Get user's communities
            const { data: userCommunities } = await supabase
              .from('community_members')
              .select('community_id')
              .eq('user_id', user.id);

            const communityIds = (userCommunities || []).map(m => m.community_id);

            if (communityIds.length === 0) {
              fetchedPosts = [];
            } else {
              // Get posts from user's communities
              const { data, error } = await supabase
                .from('community_posts')
                .select(`
                  *,
                  user:profiles(id, full_name, username, avatar_url, identity_tag),
                  community:communities(id, name),
                  likes:community_post_likes(count),
                  comments:community_post_comments(count)
                `)
                .in('community_id', communityIds)
                .order('created_at', { ascending: false })
                .range(currentOffset, currentOffset + PAGE_SIZE - 1);

              if (error) throw error;
              fetchedPosts = (data || []).filter((post: any) => post.user).map((post: any) => {
                const urls = post.media_urls || (post.media_url ? [post.media_url] : []);
                const types = post.media_types || (post.media_type ? [post.media_type] : urls.map((u: string) => {
                  if (/\.(mp4|webm|mov|avi)$/i.test(u) || u.includes('video')) return 'video';
                  if (/\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(u) || u.includes('audio')) return 'audio';
                  return 'image';
                }));
                return { ...post, media_urls: urls, media_types: types, is_community_post: true };
              });
            }
          }
        } else if (mode === 'trending') {
          // Fetch a wider pool (3× page size) so the scoring algorithm has
          // enough candidates to compare. We fetch the most recent posts in
          // the current window, score them client-side, then take PAGE_SIZE.
          const fetchSize = PAGE_SIZE * TRENDING_FETCH_MULTIPLIER;
          const { data, error } = await supabase
            .from('posts')
            .select('*, user:profiles(id, full_name, avatar_url, username, identity_tag)')
            // Pull recent posts; the score function handles time-decay,
            // so fetching newest-first gives us the right candidate pool.
            .order('created_at', { ascending: false })
            .range(currentOffset, currentOffset + fetchSize - 1);

          if (error) throw error;

          const mapped = (data || [])
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

          // Score & sort: likes×1 + comments×2 + reposts×3, decayed by age^1.8
          fetchedPosts = sortByTrending(mapped).slice(0, PAGE_SIZE);
        } else if (mode === 'explore') {
          // Explore: Fetch a wider pool and score by trending
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

          // Fetch community posts for explore
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

          // Score & sort by trending
          fetchedPosts = sortByTrending(mapped).slice(0, PAGE_SIZE);
        } else {
          // Following / Sharable modes
          let query = supabase
            .from('posts')
            .select('*, user:profiles(id, full_name, avatar_url, username, identity_tag)');

          if (mode === 'following') {
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
          } else {
            // Sharable - show newest posts
            query = query.order('created_at', { ascending: false });
          }

          query = query.range(currentOffset, currentOffset + PAGE_SIZE - 1);
          const { data, error } = await query;
          if (error) throw error;
          fetchedPosts = (data || [])
            .filter((post: any) => {
              if (!post.user) return false;
              if (mode === 'sharable' && post.user.username !== 'sharable') return false;
              return true;
            })
            .map((post: any) => {
              const urls = post.media_urls || (post.media_url ? [post.media_url] : []);
              const types = post.media_types || (post.media_type ? [post.media_type] : urls.map((u: string) => {
                if (/\.(mp4|webm|mov|avi)$/i.test(u) || u.includes('video')) return 'video';
                if (/\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(u) || u.includes('audio')) return 'audio';
                return 'image';
              }));
              return { ...post, media_urls: urls, media_types: types };
            });

          // Also fetch community posts for following mode
          if (mode === 'following') {
            let communityQuery = supabase
              .from('community_posts')
              .select(`
                *,
                user:profiles(id, full_name, username, avatar_url, identity_tag),
                community:communities(id, name),
                likes:community_post_likes(count),
                comments:community_post_comments(count)
              `);

            if (user) {
              // For following mode, only show community posts from people you follow
              const { data: followsData } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', user.id);
              const followingIds = (followsData || []).map(f => f.following_id);
              communityQuery = communityQuery.in('user_id', [...followingIds, user.id]);
            }

            const { data: communityData } = await communityQuery
              .order('created_at', { ascending: false })
              .range(currentOffset, currentOffset + PAGE_SIZE - 1);

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
              fetchedPosts = [...fetchedPosts, ...formattedCommunityPosts].sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              );
            }
          }
        }

      if (isLoadMore) {
        setPosts(prev => [...prev, ...fetchedPosts]);
        setOffset(currentOffset + PAGE_SIZE);
      } else {
        setPosts(fetchedPosts);
        setOffset(PAGE_SIZE);
      }
      setHasMore(fetchedPosts.length >= PAGE_SIZE);

      // After fetching posts, fetch user's interactions for these posts
      if (user && fetchedPosts.length > 0) {
        const postIds = fetchedPosts.filter(p => !p.is_community_post).map(p => p.id);
        if (postIds.length > 0) {
          const [likesRes, repostsRes, savesRes] = await Promise.all([
            supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
            supabase.from('reposts').select('post_id').eq('user_id', user.id).in('post_id', postIds),
            supabase.from('saved_posts').select('post_id').eq('user_id', user.id).in('post_id', postIds),
          ]);

          setUserPostStatus(prev => ({
            liked: new Set([...prev.liked, ...(likesRes.data?.map(l => l.post_id) || [])]),
            reposted: new Set([...prev.reposted, ...(repostsRes.data?.map(r => r.post_id) || [])]),
            saved: new Set([...prev.saved, ...(savesRes.data?.map(s => s.post_id) || [])]),
          }));
        }
      }

    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentUser, profile]);

  useEffect(() => {
    fetchPosts(0, feedMode);
  }, [feedMode, fetchPosts]);

  // Set up realtime listener for new posts
  useEffect(() => {
      const channel = supabase
        .channel('public:posts')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'posts'
        }, (payload) => {
          if (payload.eventType === 'INSERT') {
            // When a new post is added, refresh the first page
            fetchPosts(0, feedMode);
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted post from state
            setPosts(prev => prev.filter(p => p.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            // Update modified post in state, then re-sort if in trending mode
            setPosts(prev => {
              const updated = prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p);
              return feedMode === 'trending' ? sortByTrending([...updated]) : updated;
            });
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [feedMode, fetchPosts]);

  const loadMorePosts = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchPosts(offset, feedMode, true);
  }, [loadingMore, hasMore, offset, feedMode, fetchPosts]);

  const lastPostRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMorePosts();
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, loadMorePosts]);

  const avatarSrc = profile?.avatar_url
    ? (profile.avatar_url.startsWith('http')
        ? (() => { const m = profile.avatar_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/); return m ? `/api/media/${m[1]}/${m[2]}` : profile.avatar_url; })()
        : `/api/media/avatars/${profile.avatar_url}`)
    : null;

  return (
    <div
      className="min-h-screen bg-background text-foreground selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black"
    >
      <MainMenu
        open={mainMenuOpen}
        onClose={() => setMainMenuOpen(false)}
        avatarSrc={avatarSrc}
        feedMode={feedMode}
        pinnedFeed={pinnedFeed}
        onFeedModeChange={(mode) => setFeedMode(mode)}
        onPinnedFeedChange={(mode) => setPinnedFeed(mode)}
      />

        <header className={`fixed top-0 md:left-64 left-0 right-0 h-16 z-50 px-4 bg-white dark:bg-black rounded-b-[16px] transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="h-full flex items-center justify-between max-w-7xl mx-auto">
          {/* Left: Settings */}
          <button
            onClick={() => setMainMenuOpen(true)}
            className="p-2 text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
          >
            <Settings2 size={24} strokeWidth={1.5} />
          </button>

          {/* Center: Share */}
          <div className="flex-1 flex items-center justify-center">
            <Share2 size={24} strokeWidth={1.5} className="text-foreground" />
          </div>

          {/* Right: Messages */}
          <button
            onClick={() => router.push('/messages')}
            className="p-2 text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
          >
            <MessageCircle size={24} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <main
        className="max-w-7xl mx-auto pt-16 pb-20 md:px-0 px-0"
      >
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
            {avatarSrc ? (
              <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <UserCircle size={28} strokeWidth={1} className="text-zinc-400 dark:text-zinc-600" />
            )}
          </div>
          <Link
            href="/create/post"
            className="flex-1 h-11 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center px-5 text-zinc-500 text-[15px] font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            Anything sharable today?
          </Link>
        </div>

        <div className="flex flex-col">
          {posts.map((post, index) => (
            <div
              key={post.id}
              data-post-index={index}
              ref={(node) => {
                // Attach to lastPostRef for infinite scroll
                if (index === posts.length - 1) lastPostRef(node);
                // Track for visibility
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
