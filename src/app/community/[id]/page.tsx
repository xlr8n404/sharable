'use client';
import { useNavBack } from '@/components/NavigationHistoryProvider';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Users, ArrowLeft, Share2, Pin, Info, FileText, UserCircle, Settings } from 'lucide-react';
import CommunityPostCard from '@/components/CommunityPostCard';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { PostSkeleton } from '@/components/PostSkeleton';
import { motion, AnimatePresence } from 'framer-motion';

const MEDIA_PROXY_BASE = '/api/media';

type Tab = 'posts' | 'pinned' | 'about';

export default function CommunityDetailPage() {
  const router = useRouter();
  const { goBack } = useNavBack();
  const params = useParams();
  const communityId = params.id as string;

  const [community, setCommunity] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [postContent, setPostContent] = useState('');
  const [postLoading, setPostLoading] = useState(false);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [memberCount, setMemberCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [joinLoading, setJoinLoading] = useState(false);
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [descExpanded, setDescExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const getUser = async () => {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      setCurrentUser(data.user);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (communityId) {
      fetchCommunity();
      fetchPosts();
    }
  }, [communityId, currentUser]);

  // Lock body scroll when composer is open
  useEffect(() => {
    if (showPostComposer) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    return () => document.body.classList.remove('no-scroll');
  }, [showPostComposer]);

  const fetchCommunity = async () => {
    try {
      const res = await fetch(`/api/communities/${communityId}`);
      const data = await res.json();
      if (data.community) {
        setCommunity(data.community);
        setMemberCount(data.community.members?.length || 0);
        if (currentUser) {
          setIsMember(!!data.community.members?.some((m: any) => m.user_id === currentUser.id));
          setIsAdmin(data.community.creator_id === currentUser.id);
        }
      }
    } catch {
      toast.error('Failed to load community');
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        user_id: currentUser?.id || '',
        approved_only: isAdmin ? 'false' : 'true',
      });
      const res = await fetch(`/api/communities/${communityId}/posts?${p}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setPostCount(data.posts?.length || 0);
      setLikedPosts(new Set(data.liked_post_ids || []));
    } catch {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!currentUser) { router.push('/login'); return; }
    setJoinLoading(true);
    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id }),
      });
      if (res.ok) {
        setIsMember(true);
        setMemberCount(prev => prev + 1);
        toast.success('Joined community!');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to join');
      }
    } catch { toast.error('Error joining community'); }
    finally { setJoinLoading(false); }
  };

  const handleLeave = async () => {
    if (!currentUser) return;
    setJoinLoading(true);
    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id }),
      });
      if (res.ok) {
        setIsMember(false);
        setMemberCount(prev => Math.max(0, prev - 1));
        toast.success('Left community');
      } else {
        toast.error('Failed to leave');
      }
    } catch { toast.error('Error leaving community'); }
    finally { setJoinLoading(false); }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim()) return;
    setPostLoading(true);
    try {
      const res = await fetch(`/api/communities/${communityId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, content: postContent }),
      });
      if (res.ok) {
        const { data: newPost } = await res.json();
        setPostContent('');
        setShowPostComposer(false);
        setPosts(prev => [newPost, ...prev]);
        setPostCount(prev => prev + 1);
        toast.success('Post created!');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create post');
      }
    } catch { toast.error('Error creating post'); }
    finally { setPostLoading(false); }
  };

  const handleLike = async (postId: string) => {
    if (!currentUser) { router.push('/login'); return; }
    const res = await fetch(`/api/communities/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id }),
    });
    if (res.ok) { setLikedPosts(prev => new Set([...prev, postId])); fetchPosts(); }
  };

  const handleUnlike = async (postId: string) => {
    const res = await fetch(`/api/communities/posts/${postId}/like`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id }),
    });
    if (res.ok) {
      setLikedPosts(prev => { const s = new Set(prev); s.delete(postId); return s; });
      fetchPosts();
    }
  };

  const handleApprove = async (postId: string) => {
    const res = await fetch(`/api/communities/posts/${postId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: currentUser.id }),
    });
    if (res.ok) fetchPosts();
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: community?.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
  };

  const userAvatarSrc = currentUser?.profile?.avatar_url
    ? `${MEDIA_PROXY_BASE}/avatars/${currentUser.profile.avatar_url}`
    : null;

  const userFullName = currentUser?.profile?.full_name || currentUser?.profile?.username || 'You';

  const description = community?.description || '';
  const descTruncated = description.length > 500;
  const displayedDesc = descExpanded || !descTruncated ? description : description.slice(0, 500);

  const formatDate = (d: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // ─── Skeleton ────────────────────────────────────────────────────────────────
  if (!community) {
    return (
      <div className="min-h-screen bg-background pb-28 animate-pulse">
        <div className="w-full">
          <Skeleton className="w-full bg-zinc-100 dark:bg-zinc-900" style={{ height: '120px' }} />
          <div className="px-4">
            <div className="relative" style={{ height: '56px' }}>
              <Skeleton className="absolute -top-10 left-0 w-20 h-20 rounded-full bg-zinc-200 dark:bg-zinc-800 border-4 border-white dark:border-black" />
            </div>
            <Skeleton className="h-6 w-40 bg-zinc-200 dark:bg-zinc-800 mb-2 mt-1" />
            <Skeleton className="h-4 w-24 bg-zinc-100 dark:bg-zinc-900 mb-4" />
            <div className="flex gap-4 mb-4">
              <Skeleton className="h-4 w-16 bg-zinc-100 dark:bg-zinc-900" />
              <Skeleton className="h-4 w-20 bg-zinc-100 dark:bg-zinc-900" />
            </div>
            <Skeleton className="h-4 w-full bg-zinc-100 dark:bg-zinc-900 mb-2" />
            <Skeleton className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-900 mb-5" />
            <Skeleton className="h-10 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 mb-3" />
          </div>
          <div className="mt-4">
            {[...Array(3)].map((_, i) => <PostSkeleton key={i} />)}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <div className="w-full">

        {/* ── Cover + Avatar ─────────────────────────────────────────────── */}
        <div className="relative">
          <button
            onClick={() => goBack()}
            className="absolute top-3 left-3 z-10 p-2 bg-black/40 backdrop-blur-sm text-white rounded-full"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Settings — admin only */}
          {isAdmin && (
            <button
              onClick={() => router.push(`/community/${communityId}/settings`)}
              className="absolute top-3 right-3 z-10 p-2 bg-black/40 backdrop-blur-sm text-white rounded-full hover:bg-black/60 transition-colors"
            >
              <Settings size={18} />
            </button>
          )}

          {/* Cover */}
          <div className="w-full overflow-hidden" style={{ height: '120px' }}>
            {community.cover_url ? (
              <img src={community.cover_url} alt="cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-900" />
            )}
          </div>

          {/* Avatar — halfway down the cover */}
          <div className="absolute -bottom-10 left-4 w-20 h-20">
            <div className="w-full h-full rounded-full border-4 border-white dark:border-black overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
              {community.avatar_url ? (
                <img src={community.avatar_url} alt={community.name} className="w-full h-full object-cover" />
              ) : (
                <Users size={40} strokeWidth={1} className="text-zinc-400 dark:text-zinc-600" />
              )}
            </div>
          </div>
        </div>

        {/* ── Info ───────────────────────────────────────────────────────── */}
        <div className="mt-14 px-4">

          {/* Name + username */}
          <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
            <h1 className="text-2xl font-bold">{community.name}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              @{community.username || community.name?.toLowerCase().replace(/\s+/g, '')}
            </p>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3">
            <div className="text-center">
              <span className="font-bold">{postCount}</span>
              <span className="text-zinc-500 text-sm ml-1">Posts</span>
            </div>
            <div className="text-center">
              <span className="font-bold">{memberCount}</span>
              <span className="text-zinc-500 text-sm ml-1">Members</span>
            </div>
          </div>

          {/* Description */}
          {description && (
            <div className="mt-4">
              <p className="text-zinc-700 dark:text-zinc-300 text-[15px] leading-relaxed">
                {displayedDesc}
                {descTruncated && !descExpanded && '...'}
              </p>
              {descTruncated && (
                <button
                  onClick={() => setDescExpanded(v => !v)}
                  className="mt-1 text-sm font-bold text-foreground hover:underline"
                >
                  {descExpanded ? 'See less' : 'See more'}
                </button>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="mt-5 flex gap-3">
            {/* Not a member → single Join button */}
            {!isMember && !isAdmin && currentUser && (
              <button
                onClick={handleJoin}
                disabled={joinLoading}
                className="flex-1 py-2.5 font-bold text-sm rounded-full bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {joinLoading ? '...' : 'Join Community'}
              </button>
            )}

            {/* Member or admin → Leave + Create Post */}
            {(isMember || isAdmin) && currentUser && (
              <>
                {!isAdmin && (
                  <button
                    onClick={handleLeave}
                    disabled={joinLoading}
                    className="flex-1 py-2.5 font-bold text-sm rounded-full bg-zinc-100 dark:bg-zinc-900 text-foreground border border-black/10 dark:border-white/10 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-500/40 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {joinLoading ? '...' : 'Leave Community'}
                  </button>
                )}
                <button
                  onClick={() => setShowPostComposer(true)}
                  className="flex-1 py-2.5 font-bold text-sm rounded-full bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                >
                  Create Post
                </button>
              </>
            )}
          </div>

          {/* Tabs */}
          <div className="flex mt-6">
            {(['posts', 'pinned', 'about'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-bold transition-colors relative capitalize ${
                  activeTab === tab
                    ? 'text-foreground'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {tab === 'posts' && 'Posts'}
                {tab === 'pinned' && 'Pinned'}
                {tab === 'about' && 'About'}
                {activeTab === tab && (
                  <motion.div
                    layoutId="communityTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ──────��──────────────────────────────────────────── */}
        <div className="mt-2">
          {activeTab === 'posts' && (
            loading ? (
              <div className="space-y-0">
                {[...Array(3)].map((_, i) => <PostSkeleton key={i} />)}
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                  <FileText size={24} strokeWidth={1.5} className="text-zinc-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">No posts yet</h3>
                <p className="text-zinc-500 max-w-[240px]">Be the first to post in this community!</p>
              </div>
            ) : (
              posts.map(post => (
                <CommunityPostCard
                  key={post.id}
                  post={post}
                  isAdmin={isAdmin}
                  currentUserId={currentUser?.id}
                  isLiked={likedPosts.has(post.id)}
                  onDelete={(postId) => {
                    setPosts(prev => prev.filter(p => p.id !== postId));
                    setPostCount(prev => Math.max(0, prev - 1));
                  }}
                />
              ))
            )
          )}

          {activeTab === 'pinned' && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                <Pin size={24} strokeWidth={1.5} className="text-zinc-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">No pinned posts</h3>
              <p className="text-zinc-500 max-w-[240px]">Pinned posts will appear here.</p>
            </div>
          )}

          {activeTab === 'about' && (
              <div className="px-4 py-4 space-y-4">
                {/* Description Box */}
                <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-foreground mb-2">Description</h3>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Community
                      </span>
                    </div>
                  </div>
                  {description ? (
                    <p className="text-foreground leading-relaxed text-[15px]">{description}</p>
                  ) : (
                    <p className="text-zinc-500 text-[15px]">No description yet.</p>
                  )}
                </div>

                {/* Community Details Box */}
                <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5 space-y-6">
                  {/* Community Name */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                      <User size={20} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">community name</p>
                      <p className="font-semibold text-foreground truncate">{community.name}</p>
                    </div>
                  </div>

                  {/* Username */}
                  {community.username && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                        <span className="text-base font-bold">@</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">username</p>
                        <p className="font-semibold text-foreground">@{community.username}</p>
                      </div>
                    </div>
                  )}

                  {/* Active From */}
                  {community.created_at && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                        <Calendar size={20} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Active From</p>
                        <p className="font-semibold text-foreground">{formatDate(community.created_at)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          )}
        </div>
      </div>

      <BottomNav />

      {/* ── Create Post Composer (full-screen overlay) ───────────────────── */}
      <AnimatePresence>
        {showPostComposer && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/50"
              onClick={() => { setShowPostComposer(false); setPostContent(''); }}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
              className="fixed bottom-0 left-0 right-0 z-[70] max-w-xl mx-auto bg-white dark:bg-zinc-950 rounded-t-2xl overflow-hidden shadow-2xl flex flex-col"
              style={{ height: '90dvh' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Topbar — 64px */}
              <div className="h-16 shrink-0 flex items-center px-4 border-b border-black/5 dark:border-white/5 gap-3">
                {/* Back */}
                <button
                  onClick={() => { setShowPostComposer(false); setPostContent(''); }}
                  className="p-1.5 -ml-1.5 text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                >
                  <ArrowLeft size={24} strokeWidth={2} />
                </button>

                {/* User avatar */}
                <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 flex-shrink-0 flex items-center justify-center border border-black/10 dark:border-white/10">
                  {userAvatarSrc ? (
                    <img src={userAvatarSrc} alt={userFullName} className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle size={28} strokeWidth={1} className="text-zinc-400" />
                  )}
                </div>

                {/* Full name */}
                <span className="flex-1 font-bold text-[16px] leading-tight truncate">{userFullName}</span>

                {/* Share / Post button */}
                <button
                  onClick={handleCreatePost}
                  disabled={postLoading || !postContent.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-black dark:bg-white text-white dark:text-black font-bold text-sm rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-40"
                >
                  <Share2 size={15} strokeWidth={2} />
                  {postLoading ? 'Posting...' : 'Post'}
                </button>
              </div>

              {/* Text area */}
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={postContent}
                  onChange={e => setPostContent(e.target.value)}
                  placeholder={`Write something in ${community.name}...`}
                  className="w-full h-full min-h-[200px] bg-transparent outline-none text-[16px] text-foreground placeholder-zinc-400 dark:placeholder-zinc-600 resize-none leading-relaxed"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
