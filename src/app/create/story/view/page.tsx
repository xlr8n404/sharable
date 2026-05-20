'use client';

// ── Feature flag ── set to true when Stories is ready to launch
const STORIES_ENABLED = false;

import { useNavBack } from '@/components/NavigationHistoryProvider';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import {
  ArrowLeft,
  MoreHorizontal,
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  Bookmark,
  Clock,
  User,
  Copy,
  X,
  Send,
  UserCircle,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

const MEDIA_PROXY_BASE = '/api/media';

function getStoryPhotoUrl(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('/api/')) return photoUrl;
  if (photoUrl.startsWith('__posts__')) {
    const path = photoUrl.replace('__posts__', '');
    return `${MEDIA_PROXY_BASE}/posts/${path}`;
  }
  return `${MEDIA_PROXY_BASE}/stories/${photoUrl}`;
}

function getAvatarUrl(avatarPath: string | null | undefined, name: string) {
  if (avatarPath) {
    if (avatarPath.startsWith('http')) {
      const match = avatarPath.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
      if (match) return `${MEDIA_PROXY_BASE}/${match[1]}/${match[2]}`;
    }
    return `${MEDIA_PROXY_BASE}/avatars/${avatarPath}`;
  }
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'User')}`;
}

function formatFullDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function StoryViewContent() {
  const router = useRouter();
  const { goBack } = useNavBack();
  const searchParams = useSearchParams();
  const storyId = searchParams.get('id');

  if (!STORIES_ENABLED) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center text-center px-8">
        <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6">
          <BookOpen size={36} strokeWidth={1.5} className="text-zinc-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">Coming Soon</h2>
        <p className="text-zinc-500 text-base max-w-[280px] leading-relaxed mb-8">
          Stories is not available yet. We're working on something great — stay tuned!
        </p>
        <button
          onClick={() => goBack()}
          className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black font-bold rounded-full text-sm"
        >
          Go Back
        </button>
      </div>
    );
  }

  const [story, setStory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Interaction states
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [repostsCount, setRepostsCount] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [saved, setSaved] = useState(false);

  // Repost info (if this story is a repost)
  const [repostInfo, setRepostInfo] = useState<{ repostedAt: string; repostedBy: string } | null>(null);

  // Menu (three-dot bottom sheet)
  const [showMenu, setShowMenu] = useState(false);

  // Quick comment
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Progress bar animation
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function load() {
      if (!storyId) { goBack(); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('stories')
        .select(`
          id, user_id, content, bg_color, photo_url, created_at,
          likes_count, comments_count, reposts_count,
          reposted_id, reposted_at, reposted_by_user_id,
          user:profiles(full_name, username, avatar_url)
        `)
        .eq('id', storyId)
        .maybeSingle();

      if (error || !data) { goBack(); return; }
      setStory(data);
      setLikesCount(data.likes_count || 0);
      setCommentsCount(data.comments_count || 0);
      setRepostsCount(data.reposts_count || 0);

      if (data.reposted_id && data.reposted_at) {
        // fetch reposted by name
        const { data: reposterProfile } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', data.reposted_by_user_id)
          .maybeSingle();
        setRepostInfo({
          repostedAt: data.reposted_at,
          repostedBy: reposterProfile?.full_name || reposterProfile?.username || 'Unknown',
        });
      }

      if (user) {
        const [likeRes, repostRes, saveRes] = await Promise.all([
          supabase.from('story_likes').select('id').eq('user_id', user.id).eq('story_id', storyId).maybeSingle(),
          supabase.from('story_reposts').select('id').eq('user_id', user.id).eq('story_id', storyId).maybeSingle(),
          supabase.from('story_saves').select('id').eq('user_id', user.id).eq('story_id', storyId).maybeSingle(),
        ]);
        setLiked(!!likeRes.data);
        setReposted(!!repostRes.data);
        setSaved(!!saveRes.data);
      }

      setLoading(false);
    }
    load();
  }, [storyId, router]);

  // Animated progress bar (runs 0→100 over ~8s)
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    const totalMs = 8000;
    const intervalMs = 50;
    const step = (intervalMs / totalMs) * 100;
    progressRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (progressRef.current) clearInterval(progressRef.current);
          return 100;
        }
        return prev + step;
      });
    }, intervalMs);
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [story]);

  const handleLike = async () => {
    if (!currentUserId) { toast.error('Please login to like'); return; }
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);
    if (wasLiked) {
      await supabase.from('story_likes').delete().eq('user_id', currentUserId).eq('story_id', storyId!);
    } else {
      await supabase.from('story_likes').insert({ user_id: currentUserId, story_id: storyId });
    }
    await supabase.from('stories').update({ likes_count: likesCount + (wasLiked ? -1 : 1) }).eq('id', storyId!);
  };

  const handleRepost = async () => {
    if (!currentUserId) { toast.error('Please login to repost'); return; }
    const wasReposted = reposted;
    setReposted(!wasReposted);
    setRepostsCount(prev => wasReposted ? Math.max(0, prev - 1) : prev + 1);
    if (wasReposted) {
      await supabase.from('story_reposts').delete().eq('user_id', currentUserId).eq('story_id', storyId!);
      toast.success('Repost removed');
    } else {
      await supabase.from('story_reposts').insert({ user_id: currentUserId, story_id: storyId });
      toast.success('Reposted!');
    }
    await supabase.from('stories').update({ reposts_count: repostsCount + (wasReposted ? -1 : 1) }).eq('id', storyId!);
  };

  const handleSave = async () => {
    if (!currentUserId) { toast.error('Please login to save'); return; }
    const wasSaved = saved;
    setSaved(!wasSaved);
    toast.success(!wasSaved ? 'Story saved' : 'Removed from saved');
    if (wasSaved) {
      await supabase.from('story_saves').delete().eq('user_id', currentUserId).eq('story_id', storyId!);
    } else {
      await supabase.from('story_saves').insert({ user_id: currentUserId, story_id: storyId });
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/create/story/view?id=${storyId}`;
    if (navigator.share) {
      await navigator.share({ title: 'Story', url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteStory = async () => {
    if (!currentUserId || currentUserId !== story?.user_id) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('stories').delete().eq('id', storyId!);
      if (error) throw error;
      toast.success('Story deleted');
      router.push('/stories');
    } catch {
      toast.error('Failed to delete story');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!currentUserId) { toast.error('Please login to comment'); return; }
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await supabase.from('story_comments').insert({
        user_id: currentUserId,
        story_id: storyId,
        content: commentText.trim(),
      });
      await supabase
        .from('stories')
        .update({ comments_count: commentsCount + 1 })
        .eq('id', storyId!);
      setCommentsCount(prev => prev + 1);
      setCommentText('');
      setShowCommentInput(false);
      toast.success('Comment posted');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading || !story) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const avatarSrc = getAvatarUrl(story.user?.avatar_url, story.user?.full_name || 'User');
  const photoSrc = getStoryPhotoUrl(story.photo_url);

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ backgroundColor: photoSrc ? '#000' : (story.bg_color || '#18181b') }}
    >
      {/* Background photo */}
      {photoSrc && (
        <img src={photoSrc} alt="Story" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {photoSrc && <div className="absolute inset-0 bg-black/25" />}

      {/* Progress bar */}
      <div className="relative z-20 px-4 pt-12">
        <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0 }}
          />
        </div>
      </div>

      {/* Top info bar */}
      <div className="relative z-20 flex items-center px-4 pt-3 pb-2 gap-3">
        <button
          onClick={() => goBack()}
          className="p-1 rounded-full text-white hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={24} strokeWidth={2} />
        </button>

        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/60 bg-zinc-700 flex-shrink-0">
          {story.user?.avatar_url ? (
            <img src={avatarSrc} alt={story.user?.full_name} className="w-full h-full object-cover" />
          ) : (
            <UserCircle size={40} strokeWidth={1} className="text-zinc-400 w-full h-full" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white font-bold text-[16px] leading-tight truncate">
              {story.user?.full_name || story.user?.username || 'User'}
            </span>
            <VerifiedBadge username={story.user?.username} className="w-4 h-4 text-white flex-shrink-0" />
            <span className="text-white/70 text-sm truncate">@{story.user?.username}</span>
          </div>
        </div>

        <button
          onClick={() => setShowMenu(true)}
          className="p-1.5 rounded-full text-white hover:bg-white/10 transition-colors"
        >
          <MoreHorizontal size={24} strokeWidth={1.5} />
        </button>
      </div>

      {/* Story content (centered) */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-8 pointer-events-none">
        {story.content && (
          <p
            className="text-white text-2xl font-bold text-center leading-snug"
            style={{ textShadow: photoSrc ? '0 2px 8px rgba(0,0,0,0.7)' : 'none' }}
          >
            {story.content}
          </p>
        )}
      </div>

      {/* Bottom area: pill comment + right side icons */}
      <div className="relative z-20 flex items-end px-4 pb-10 gap-3">
        {/* Pill comment button */}
        <button
          onClick={() => setShowCommentInput(true)}
          className="flex-1 h-12 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm flex items-center px-4 gap-2 text-white/80 text-sm font-medium hover:bg-white/20 transition-colors"
        >
          <MessageCircle size={18} strokeWidth={1.5} className="flex-shrink-0" />
          <span>Share your thoughts 💬</span>
        </button>

        {/* Right side vertical interaction icons */}
        <div className="flex flex-col items-center gap-5 pb-1">
          {/* Like */}
          <button onClick={handleLike} className="flex flex-col items-center gap-1">
            <Heart
              size={28}
              strokeWidth={1.5}
              className={`transition-colors ${liked ? 'text-red-500 fill-red-500' : 'text-white'}`}
            />
            {likesCount > 0 && (
              <span className="text-white text-xs font-semibold">{formatCount(likesCount)}</span>
            )}
          </button>

          {/* Comment */}
          <button onClick={() => setShowCommentInput(true)} className="flex flex-col items-center gap-1">
            <MessageCircle size={28} strokeWidth={1.5} className="text-white" />
            {commentsCount > 0 && (
              <span className="text-white text-xs font-semibold">{formatCount(commentsCount)}</span>
            )}
          </button>

          {/* Repost */}
          <button onClick={handleRepost} className="flex flex-col items-center gap-1">
            <Repeat2
              size={28}
              strokeWidth={1.5}
              className={`transition-colors ${reposted ? 'text-green-400' : 'text-white'}`}
            />
            {repostsCount > 0 && (
              <span className="text-white text-xs font-semibold">{formatCount(repostsCount)}</span>
            )}
          </button>

          {/* Share */}
          <button onClick={handleShare} className="flex flex-col items-center gap-1">
            <Share2 size={28} strokeWidth={1.5} className="text-white" />
          </button>

          {/* Save */}
          <button onClick={handleSave} className="flex flex-col items-center gap-1">
            <Bookmark
              size={28}
              strokeWidth={1.5}
              className={`transition-colors ${saved ? 'text-white fill-white' : 'text-white'}`}
            />
          </button>
        </div>
      </div>

      {/* Three-dot menu bottom sheet */}
      <Drawer open={showMenu} onOpenChange={(open) => { setShowMenu(open); if (!open) setShowDeleteConfirm(false); }}>
        <DrawerContent className="bg-zinc-100 dark:bg-zinc-900 border-black/10 dark:border-white/10 pb-8 rounded-t-2xl">
          <div className="mx-auto w-full max-w-xl">
            <div className="flex flex-col py-4">
              {/* Posted info */}
              <div className="flex flex-col gap-4 px-4 py-4 border-b border-black/5 dark:border-white/5 mb-2">
                <div className="flex items-center gap-4 text-zinc-500">
                  <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                    <Clock className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Posted on</span>
                    <span className="text-base font-medium text-foreground">
                      {story.created_at ? formatFullDate(story.created_at) : 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900">
                    <img src={avatarSrc} alt={story.user?.full_name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Posted by</span>
                    <span className="text-base font-bold text-foreground">
                      {story.user?.full_name || story.user?.username || 'Unknown'}
                    </span>
                  </div>
                </div>

                {repostInfo && (
                  <>
                    <div className="flex items-center gap-4 text-zinc-500">
                      <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                        <Clock className="w-5 h-5" strokeWidth={1.5} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Reposted on</span>
                        <span className="text-base font-medium text-foreground">
                          {formatFullDate(repostInfo.repostedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                        <User className="w-5 h-5" strokeWidth={1.5} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Reposted by</span>
                        <span className="text-base font-bold text-foreground">{repostInfo.repostedBy}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {showDeleteConfirm ? (
                <div className="px-4 py-2 space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-bold">Delete story?</h3>
                    <p className="text-zinc-500">This action cannot be undone.</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-4 py-3 text-base font-bold bg-zinc-200 dark:bg-zinc-800 rounded-2xl hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteStory}
                      disabled={deleting}
                      className="flex-1 px-4 py-3 text-base font-bold bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    >
                      {deleting ? (
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : 'Delete'}
                    </button>
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 gap-1">
                {/* Save */}
                <button
                  onClick={() => { handleSave(); setShowMenu(false); }}
                  className="w-full flex items-center gap-4 px-4 py-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                    <Bookmark className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <span className="text-lg font-bold">{saved ? 'Remove from saved' : 'Save story'}</span>
                </button>

                {/* Copy text */}
                {story.content && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(story.content);
                      toast.success('Text copied');
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-4 px-4 py-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                      <Copy className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    <span className="text-lg font-bold">Copy text</span>
                  </button>
                )}

                {/* Share */}
                <button
                  onClick={() => { handleShare(); setShowMenu(false); }}
                  className="w-full flex items-center gap-4 px-4 py-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                    <Share2 className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <span className="text-lg font-bold">Share story</span>
                </button>

                {/* Delete — only for story owner */}
                {currentUserId === story.user_id && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center gap-4 px-4 py-4 text-red-500 hover:bg-red-500/10 rounded-2xl transition-colors text-left mt-2 border-t border-black/5 dark:border-white/5"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                      <Trash2 className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    <span className="text-lg font-bold">Delete story</span>
                  </button>
                )}
              </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Quick comment input overlay */}
      <AnimatePresence>
        {showCommentInput && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
            onClick={() => setShowCommentInput(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="w-full max-w-xl bg-zinc-900 rounded-t-3xl p-4 pb-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <input
                  autoFocus
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment(); }}
                  placeholder="Share your thoughts 💬"
                  className="flex-1 bg-zinc-800 text-white rounded-full px-4 py-3 text-sm outline-none placeholder-zinc-500"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={submittingComment || !commentText.trim()}
                  className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-40 transition-opacity"
                >
                  <Send size={18} strokeWidth={2} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StoryViewPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <StoryViewContent />
    </Suspense>
  );
}
