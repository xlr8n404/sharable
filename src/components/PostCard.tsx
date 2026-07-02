'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Trash2, Bookmark, Copy, Repeat, CornerRightDown, Settings2, Play, MapPin, Send, X } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MentionText } from '@/components/MentionText';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

// Global video manager — only one video plays at a time across all PostCards
const videoManager = {
  currentVideo: null as HTMLVideoElement | null,
  register(video: HTMLVideoElement) {
    if (this.currentVideo && this.currentVideo !== video) {
      this.currentVideo.pause();
    }
    this.currentVideo = video;
  },
  unregister(video: HTMLVideoElement) {
    if (this.currentVideo === video) this.currentVideo = null;
  },
};

// Media is served through our authenticated proxy — never expose raw Supabase storage URLs
const MEDIA_PROXY_BASE = '/api/media';

interface PostCardProps {
  id: string;
  user_id?: string;
  post_number?: number;
  slug?: string;
  user: {
    full_name: string;
    avatar_url?: string | null;
    username?: string;
    identity_tag?: string | null;
  };
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  media_urls?: string[];
  media_types?: string[];
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  views_count?: number;
  reposted_id?: string;
  original_post?: any;
  created_at?: string;
  onDelete?: (postId: string) => void;
  avatarSize?: number;
  isNested?: boolean;
  community?: { id: string; name: string };
  is_community_post?: boolean;
  isFollower?: boolean;
  // Pre-fetched from parent to avoid N+1 queries per card
  currentUserId?: string | null;
  currentUserProfile?: { full_name: string; avatar_url: string; username?: string } | null;
  initialLiked?: boolean;
  initialReposted?: boolean;
  initialSaved?: boolean;
  // Whether this card is visible in the viewport (for lazy media loading)
  isVisible?: boolean;
  // Location information
  location_name?: string | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
}

interface CommentReply {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  votes_count?: number;
  user: {
    full_name: string;
    avatar_url?: string | null;
    username?: string;
  };
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user: {
    full_name: string;
    avatar_url?: string | null;
    username?: string;
  };
  replies?: CommentReply[];
  votes_count?: number;
}

// A video that only loads when src is set, and pauses other playing videos
function LazyVideo({ src, className, controls, isSingle, onClick, onDoubleClick }: {
  src: string;
  className?: string;
  controls?: boolean;
  isSingle?: boolean;
  onClick?: (e: React.MouseEvent<HTMLVideoElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLVideoElement>) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [metaLoaded, setMetaLoaded] = useState(false);

  const handlePlay = useCallback(() => {
    if (ref.current) videoManager.register(ref.current);
  }, []);

  useEffect(() => {
    return () => {
      if (ref.current) videoManager.unregister(ref.current);
    };
  }, []);

  if (!src) {
    // Placeholder while not visible
    return (
      <div className={`${className} bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center ${isSingle ? 'aspect-video' : ''}`}>
        <Play className="w-10 h-10 text-zinc-400" />
      </div>
    );
  }

  return (
    <div className={isSingle ? 'w-full' : 'w-full h-full'}>
      {/* Show 16:9 placeholder until metadata (dimensions) are known */}
      {isSingle && !metaLoaded && (
        <div className="w-full aspect-video bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
          <Play className="w-10 h-10 text-zinc-400" />
        </div>
      )}
      <video
        ref={ref}
        src={src}
        className={`${className} ${isSingle && !metaLoaded ? 'hidden' : ''}`}
        controls={controls}
        preload="metadata"
        playsInline
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onPlay={handlePlay}
        onLoadedMetadata={() => setMetaLoaded(true)}
      />
    </div>
  );
}

// Standalone grid cell — must be outside PostCard to avoid React remount-on-render bug
function MediaGridCell({
  url,
  type,
  index,
  overlay,
  isVisible,
  onOpen,
  isSingle,
}: {
  url: string;
  type: string;
  index: number;
  overlay?: number;
  isVisible: boolean;
  onOpen?: (url: string, type: string) => void;
  isSingle?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-zinc-100 dark:bg-zinc-900 cursor-pointer group w-full ${isSingle ? 'h-auto' : 'h-full'}`}
      onClick={() => onOpen?.(url, type)}
    >
      {type === 'video' ? (
        <LazyVideo
          src={isVisible ? url : ''}
          className={`w-full ${isSingle ? 'h-auto' : 'h-full object-cover'}`}
          controls={isSingle}
          isSingle={isSingle}
        />
      ) : (
        <img
          src={url}
          alt={`Post media ${index + 1}`}
          className={`w-full ${isSingle ? 'h-auto object-contain' : 'h-full object-cover'}`}
          loading="lazy"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (!img.dataset.retried) { img.dataset.retried = '1'; const s = img.src; img.src = ''; img.src = s; }
          }}
        />
      )}
      {overlay && overlay > 0 ? (
        <div className="absolute inset-0 bg-black/55 flex items-center justify-center pointer-events-none">
          <span className="text-white font-bold text-2xl">+{overlay}</span>
        </div>
      ) : (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors pointer-events-none" />
      )}
    </div>
  );
}

export function PostCard({
  id,
  user_id,
  post_number,
  slug,
  user,
  content,
  media_url,
  media_type,
  media_urls = [],
  media_types = [],
  likes_count: initialLikes = 0,
  comments_count: initialComments = 0,
  reposts_count: initialReposts = 0,
  views_count: initialViews = 0,
  reposted_id,
  original_post,
  created_at,
  onDelete,
  avatarSize = 40,
  isNested = false,
  community,
  is_community_post,
  isFollower = false,
  currentUserId: propCurrentUserId,
  currentUserProfile: propCurrentUserProfile,
  initialLiked = false,
  initialReposted = false,
  initialSaved = false,
  isVisible = true,
  location_name,
  location_latitude,
  location_longitude,
}: PostCardProps) {
  const router = useRouter();

  // Convert a raw Supabase storage URL (or relative path) to our authenticated proxy URL
  const toProxyUrl = (url: string): string => {
    if (!url) return url;
    // Already proxied
    if (url.startsWith('/api/media/')) return url;
    // Full Supabase storage URL
    const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (match) return `${MEDIA_PROXY_BASE}/${match[1]}/${match[2]}`;
    // Relative path like "posts/user-id/file.jpg"
    if (!url.startsWith('http')) return `${MEDIA_PROXY_BASE}/${url}`;
    return url;
  };

  // Merge legacy single media into arrays if they exist and arrays are empty
  const rawMediaUrls = (media_urls && media_urls.length > 0) ? media_urls : (media_url ? [media_url] : []);
  // Route all media through the authenticated proxy
  const finalMediaUrls = rawMediaUrls.map(toProxyUrl);

  // Derive media type from URL extension if type is missing
  const inferType = (url: string): string => {
    if (/\.(mp4|webm|mov|avi)(\?|$)/i.test(url)) return 'video';
    if (/\.(mp3|wav|ogg|aac|flac|m4a)(\?|$)/i.test(url)) return 'audio';
    return 'image';
  };
  const rawTypes = (media_types && media_types.length > 0) ? media_types : (media_type ? [media_type] : []);
  const finalMediaTypes = finalMediaUrls.map((url, i) => rawTypes[i] || inferType(url));

  // Limit to max 3 media items per post
  const displayMediaUrls = finalMediaUrls.slice(0, 3);
  const displayMediaTypes = finalMediaTypes.slice(0, 3);

  const hasMedia = displayMediaUrls.length > 0 && displayMediaUrls[0] !== null && displayMediaUrls[0] !== '';

  const [currentUserId, setCurrentUserId] = useState<string | null>(propCurrentUserId ?? null);
  const [liked, setLiked] = useState(initialLiked);
  const [liking, setLiking] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [viewsCount, setViewsCount] = useState(initialViews);

  // Sync liked/reposted/saved state when parent updates userPostStatus
  useEffect(() => { if (!liking) setLiked(initialLiked); }, [initialLiked]);
  useEffect(() => { setLikesCount(initialLikes); }, [initialLikes]);
  useEffect(() => { setViewsCount(initialViews); }, [initialViews]);
  const [commentsCount, setCommentsCount] = useState(initialComments);
  const [repostsCount, setRepostsCount] = useState(initialReposts);
  const [reposted, setReposted] = useState(initialReposted);
  const [showRepostConfirm, setShowRepostConfirm] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentSortOrder, setCommentSortOrder] = useState<'ranked' | 'newest' | 'oldest'>('ranked');
  const [showCommentSortMenu, setShowCommentSortMenu] = useState(false);
  const [selectedCommentMenu, setSelectedCommentMenu] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showPostMenuSheet, setShowPostMenuSheet] = useState(false);
  const [deleting, setDeleting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
    const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
    const [currentUserProfile, setCurrentUserProfile] = useState<{ full_name: string; avatar_url: string; username?: string } | null>(propCurrentUserProfile ?? null);
    const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
      const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
      const [isSaved, setIsSaved] = useState(initialSaved);
      const [mentionResults, setMentionResults] = useState<any[]>([]);
      const [showMentions, setShowMentions] = useState(false);
        const [viewportHeight, setViewportHeight] = useState<number | null>(null);
        const [votedComments, setVotedComments] = useState<Set<string>>(new Set());
        const [showCommentMenu, setShowCommentMenu] = useState<string | null>(null);
        const commentsEndRef = useRef<HTMLDivElement>(null);

        const scrollToBottom = () => {
          commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        };

        useEffect(() => {
          // Disabled: Do not auto-scroll to bottom when opening comments
          // if (showComments) {
          //   scrollToBottom();
          // }
        }, [comments, showComments]);

          useEffect(() => {
            if (typeof window === 'undefined' || !window.visualViewport) return;

            const handleResize = () => {
              if (window.visualViewport) {
                const newHeight = window.visualViewport.height;
                setViewportHeight(newHeight);
                
                // Disabled: Do not scroll when keyboard opens
                // if (newHeight < window.innerHeight * 0.8) {
                //   setTimeout(scrollToBottom, 150);
                // }
              }
            };

            window.visualViewport.addEventListener('resize', handleResize);
            // Initialize height
            setViewportHeight(window.visualViewport.height);

            return () => {
              window.visualViewport?.removeEventListener('resize', handleResize);
            };
          }, []); // Only once on mount

        const commentInputRef = useRef<HTMLTextAreaElement>(null);


  const handleCommentChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewComment(value);
    
    // Auto-expand height
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@') && lastWord.length > 1) {
      const query = lastWord.substring(1);
      const { data } = await supabase
        .from('profiles')
        .select('username, full_name, avatar_url')
        .ilike('username', `${query}%`)
        .limit(5);
      
      if (data && data.length > 0) {
        setMentionResults(data);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (username: string) => {
    if (!commentInputRef.current) return;
    
    const cursorPosition = commentInputRef.current.selectionStart;
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const textAfterCursor = newComment.substring(cursorPosition);
    
    const words = textBeforeCursor.split(/\s/);
    words[words.length - 1] = `@${username} `;
    
    const newValue = words.join(' ') + textAfterCursor;
    setNewComment(newValue);
    setShowMentions(false);
    commentInputRef.current.focus();
  };

  const handleSavePost = async () => {
    if (!currentUserId) {
      toast.error('Please login to save posts');
      return;
    }

    const wasSaved = isSaved;
    setIsSaved(!isSaved);

    try {
      if (wasSaved) {
        await supabase
          .from('saved_posts')
          .delete()
          .eq('user_id', currentUserId)
          .eq('post_id', id);
        toast.success('Post removed from saved');
      } else {
        await supabase
          .from('saved_posts')
          .upsert({ 
            user_id: currentUserId,
            post_id: id,
          });
        toast.success('Post saved');
      }
    } catch (error) {
      setIsSaved(wasSaved);
      toast.error('Failed to save post');
    }
  };

  const handleLike = async () => {
    if (!currentUserId) {
      toast.error('Please login to like posts');
      return;
    }

    const wasLiked = liked;
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);
    setLiking(true);

    try {
      if (wasLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('user_id', currentUserId)
          .eq('post_id', id);
      } else {
        await supabase
          .from('post_likes')
          .insert({ user_id: currentUserId, post_id: id });
      }
    } catch (error) {
      setLiked(wasLiked);
      setLikesCount(wasLiked ? likesCount + 1 : likesCount - 1);
      toast.error('Failed to like post');
    } finally {
      setLiking(false);
    }
  };

  const handleSharePost = async () => {
    const postUrl = `${window.location.origin}/post/${id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${user.full_name}`,
          text: content.substring(0, 100),
          url: postUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          navigator.clipboard.writeText(postUrl);
          toast.success('Link copied to clipboard');
        }
      }
    } else {
      navigator.clipboard.writeText(postUrl);
      toast.success('Link copied to clipboard');
    }
  };

  const handleRepost = async () => {
    if (!currentUserId) {
      toast.error('Please login to repost');
      return;
    }

    setReposting(true);
    try {
      if (reposted) {
        await supabase
          .from('reposts')
          .delete()
          .eq('user_id', currentUserId)
          .eq('post_id', id);
        setReposted(false);
        setRepostsCount(Math.max(0, repostsCount - 1));
        toast.success('Repost removed');
      } else {
        await supabase
          .from('reposts')
          .insert({ user_id: currentUserId, post_id: id });
        setReposted(true);
        setRepostsCount(repostsCount + 1);
        toast.success('Reposted!');
      }
      setShowRepostConfirm(false);
    } catch (error) {
      toast.error('Failed to repost');
    } finally {
      setReposting(false);
    }
  };

  const handleOpenComments = async () => {
    setShowComments(!showComments);
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const { data, error } = await supabase
          .from('comments')
          .select(`
            id,
            content,
            created_at,
            user_id,
            votes_count,
            user:profiles(full_name, avatar_url, username),
            replies:comment_replies(
              id,
              content,
              created_at,
              user_id,
              votes_count,
              user:profiles(full_name, avatar_url, username)
            )
          `)
          .eq('post_id', id)
          .order('votes_count', { ascending: false });

        if (error) throw error;
        setComments(data || []);
      } catch (error) {
        toast.error('Failed to load comments');
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUserId) {
      toast.error('Please enter a comment');
      return;
    }

    setSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: id,
          user_id: currentUserId,
          content: newComment,
        })
        .select(`
          id,
          content,
          created_at,
          user_id,
          votes_count,
          user:profiles(full_name, avatar_url, username)
        `)
        .single();

      if (error) throw error;

      setComments([data, ...comments]);
      setNewComment('');
      setCommentsCount(commentsCount + 1);
      toast.success('Comment posted!');
    } catch (error) {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      setComments(comments.filter(c => c.id !== commentId));
      setCommentsCount(Math.max(0, commentsCount - 1));
      toast.success('Comment deleted');
      setDeletingCommentId(null);
    } catch (error) {
      toast.error('Failed to delete comment');
    }
  };

  const handleVoteComment = async (commentId: string) => {
    if (!currentUserId) {
      toast.error('Please login to vote');
      return;
    }

    const hasVoted = votedComments.has(commentId);
    const newVoted = new Set(votedComments);

    if (hasVoted) {
      newVoted.delete(commentId);
    } else {
      newVoted.add(commentId);
    }

    setVotedComments(newVoted);

    try {
      if (hasVoted) {
        await supabase
          .from('comment_votes')
          .delete()
          .eq('user_id', currentUserId)
          .eq('comment_id', commentId);
      } else {
        await supabase
          .from('comment_votes')
          .insert({ user_id: currentUserId, comment_id: commentId });
      }
    } catch (error) {
      setVotedComments(votedComments);
      toast.error('Failed to vote');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase
        .from('posts')
        .delete()
        .eq('id', id);
      
      toast.success('Post deleted');
      onDelete?.(id);
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error('Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  // Get avatar source
  const avatarSrc = user.avatar_url 
    ? (user.avatar_url.startsWith('http') 
        ? user.avatar_url 
        : `${MEDIA_PROXY_BASE}/avatars/${user.avatar_url}`)
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.full_name || 'User')}`;

  // Format time helper
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (reposted_id && !isNested) {
    if (!original_post) {
      return (
        <div className="p-4 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2 text-zinc-500 mb-2">
            <Repeat className="w-4 h-4" />
            <span className="text-sm font-medium">Reposted by {user.full_name}</span>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5">
            <p className="text-zinc-500 italic">Original post unavailable</p>
          </div>
        </div>
      );
    }

    return (
      <div className="border-b border-black/5 dark:border-white/5 pb-2">
        <div className="px-4 py-2 flex items-center gap-2 text-zinc-500">
          <Repeat className="w-4 h-4" />
          <span className="text-sm font-medium">Reposted by {user.full_name}</span>
        </div>
        <PostCard 
          {...original_post} 
          isNested={true} 
          currentUserId={currentUserId}
          currentUserProfile={currentUserProfile}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isNested ? 'bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl mx-4 mb-2 border border-black/5 dark:border-white/5' : 'border-b border-black/5 dark:border-white/5'}`}>
      <div className="flex flex-col p-4 pb-2">
        {/* Header: Avatar, Name, and More button */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1">
            <Link href={`/${user.username || user_id}`} className="shrink-0">
              <div className="rounded-full overflow-hidden border border-black/5 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center" style={{ width: avatarSize, height: avatarSize }}>
                <img 
                  src={avatarSrc} 
                  alt={user.full_name} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.full_name || 'User')}`;
                  }}
                />
              </div>
            </Link>
            <div className="flex items-center gap-1.5">
              <Link href={`/${user.username || user_id}`} className="font-bold text-[16px] hover:underline leading-tight">
                {user.full_name}
              </Link>
              {user.identity_tag && (
                <VerifiedBadge identity_tag={user.identity_tag} />
              )}
              {isFollower && !isNested && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="text-[13px] font-medium text-zinc-400">Following</span>
                </>
              )}
            </div>
          </div>
          {!isNested && (
            <button
              onClick={() => setShowPostMenuSheet(true)}
              className="p-3 text-zinc-400 hover:text-black dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <MoreHorizontal size={24} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="mb-3">
          <p className="text-[16px] text-zinc-800 dark:text-zinc-200 leading-normal whitespace-pre-wrap break-words">
            <MentionText text={content} />
          </p>
        </div>

        {/* Media */}
        {hasMedia && (
          <div className="mb-3 rounded-2xl overflow-hidden border border-black/5 dark:border-white/10">
            {displayMediaUrls.length === 1 ? (
              // Single media: show at original aspect ratio
              <MediaGridCell
                url={displayMediaUrls[0]}
                type={displayMediaTypes[0]}
                index={0}
                isVisible={isVisible}
                isSingle={true}
              />
            ) : displayMediaUrls.length === 2 ? (
              // 2 media: side by side 1:1 each
              <div className="grid grid-cols-2 gap-[2px]">
                {displayMediaUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square overflow-hidden">
                    <div className="absolute inset-0">
                      <MediaGridCell
                        url={url}
                        type={displayMediaTypes[index]}
                        index={index}
                        isVisible={isVisible}
                        isSingle={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // 3 media: left 1 large full-height, right 2 stacked equal halves
              <div className="grid grid-cols-2 gap-[2px]" style={{ aspectRatio: '1/1' }}>
                <div className="relative overflow-hidden" style={{ height: '100%' }}>
                  <div className="absolute inset-0">
                    <MediaGridCell
                      url={displayMediaUrls[0]}
                      type={displayMediaTypes[0]}
                      index={0}
                      isVisible={isVisible}
                      isSingle={false}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-[2px]" style={{ height: '100%' }}>
                  {displayMediaUrls.slice(1, 3).map((url, index) => (
                    <div key={index + 1} className="relative overflow-hidden" style={{ flex: 1, minHeight: 0 }}>
                      <div className="absolute inset-0">
                        <MediaGridCell
                          url={url}
                          type={displayMediaTypes[index + 1]}
                          index={index + 1}
                          isVisible={isVisible}
                          isSingle={false}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Details: Username, Time, Location, Community */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 text-zinc-500 text-[13px] flex-wrap">
            <span className="font-medium">@{user.username || 'user'}</span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span>{created_at ? formatTime(created_at) : 'now'}</span>
            {location_name && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <div className="flex items-center gap-1">
                  <MapPin size={12} strokeWidth={2} />
                  <span>{location_name}</span>
                </div>
              </>
            )}
            {community && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <Link href={`/community/${community.id}`} className="text-blue-500 hover:underline font-medium">
                  {community.name}
                </Link>
              </>
            )}
          </div>
        </div>

            <div className="flex items-center justify-between pt-0 pb-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-1.5 p-2 rounded-full group transition-colors ${
                    liked ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  <Heart
                    className={`w-6 h-6 group-active:scale-125 transition-transform ${liked ? 'fill-current' : ''}`}
                      strokeWidth={1.5}
                    />
                    <span className="text-base font-medium">{likesCount}</span>
                  </button>
                <button
                  onClick={handleOpenComments}
                  className="flex items-center gap-1.5 p-2 rounded-full group text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                    <MessageCircle className="w-6 h-6 group-active:scale-125 transition-transform" strokeWidth={1.5} />
                    <span className="text-base font-medium">{commentsCount}</span>
                  </button>
                <button
                  onClick={handleSharePost}
                  className="flex items-center gap-1.5 p-2 rounded-full group text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                    <Share2 className="w-6 h-6 group-active:scale-125 transition-transform" strokeWidth={1.5} />
                  </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRepostConfirm(true)}
                  className={`flex items-center gap-1.5 p-2 rounded-full group transition-colors ${
                    reposted ? 'text-green-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  <Repeat className={`w-6 h-6 group-active:rotate-180 transition-transform ${reposted ? 'stroke-[2.5px]' : ''}`} strokeWidth={1.5} />
                  <span className="text-base font-medium">{repostsCount}</span>
                </button>
                <button
                  onClick={handleSavePost}
                  className={`flex items-center p-2 rounded-full group transition-colors ${
                    isSaved ? 'text-yellow-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  <Bookmark className={`w-6 h-6 group-active:scale-125 transition-transform ${isSaved ? 'fill-current' : ''}`} strokeWidth={1.5} />
                </button>
              </div>
            </div>
      </div>

            <Drawer open={showRepostConfirm} onOpenChange={setShowRepostConfirm}>
              <DrawerContent className="bg-zinc-100 dark:bg-zinc-900 border-black/10 dark:border-white/10 pb-8 rounded-t-[8px]">
              <div className="mx-auto w-full max-w-xl">
                <div className="py-6 px-4 space-y-4">
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold">{reposted ? 'Remove repost?' : 'Repost this?'}</h3>
                  <p className="text-zinc-500">
                    {reposted 
                      ? 'This will remove the repost from your profile and feed.' 
                      : 'This will share this post to your profile and the feed of your followers.'}
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowRepostConfirm(false)}
                    className="flex-1 px-4 py-3 text-base font-bold bg-zinc-200 dark:bg-zinc-800 rounded-2xl hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRepost}
                    disabled={reposting}
                    className="flex-1 px-4 py-3 text-base font-bold bg-green-500 text-white rounded-2xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                  >
                    {reposting ? <Loader centered={false} className="text-current" /> : (reposted ? 'Remove' : 'Repost')}
                  </button>
                </div>
              </div>
              </DrawerContent>
            </Drawer>

      {showComments && (
        <div className="border-t border-black/5 dark:border-white/5 bg-white dark:bg-zinc-950">
          <div className="max-h-[60vh] overflow-y-auto">
            {loadingComments ? (
              <div className="flex items-center justify-center py-8">
                <Loader centered={true} />
              </div>
            ) : comments.length > 0 ? (
              comments.map((comment) => {
                const hasVoted = votedComments.has(comment.id);
                return (
                  <div key={comment.id} className="border-b border-black/5 dark:border-white/5 p-4">
                    <div className="flex gap-3">
                      <div className="shrink-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                          <img 
                            src={comment.user.avatar_url ? `${MEDIA_PROXY_BASE}/avatars/${comment.user.avatar_url}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(comment.user.full_name || 'User')}`}
                            alt={comment.user.full_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-bold text-sm">{comment.user.full_name}</span>
                          <span className="text-zinc-400 text-xs">@{comment.user.username}</span>
                          <span className="text-zinc-400 text-xs">{formatTime(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 break-words">{comment.content}</p>
                        {comment.replies && comment.replies.length > 0 && (
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedReplies);
                              if (newExpanded.has(comment.id)) {
                                newExpanded.delete(comment.id);
                              } else {
                                newExpanded.add(comment.id);
                              }
                              setExpandedReplies(newExpanded);
                            }}
                            className="text-xs text-blue-500 hover:underline mt-2"
                          >
                            {expandedReplies.has(comment.id) ? 'Hide' : 'Show'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                          </button>
                        )}
                        {expandedReplies.has(comment.id) && comment.replies && (
                          <div className="mt-3 space-y-3 pl-3 border-l border-zinc-200 dark:border-zinc-800">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="flex gap-2">
                                <div className="shrink-0">
                                  <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                                    <img 
                                      src={reply.user.avatar_url ? `${MEDIA_PROXY_BASE}/avatars/${reply.user.avatar_url}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(reply.user.full_name || 'User')}`}
                                      alt={reply.user.full_name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 mb-1">
                                    <span className="font-bold text-xs">{reply.user.full_name}</span>
                                    <span className="text-zinc-400 text-xs">@{reply.user.username}</span>
                                    <span className="text-zinc-400 text-xs">{formatTime(reply.created_at)}</span>
                                  </div>
                                  <p className="text-xs text-zinc-800 dark:text-zinc-200 break-words">{reply.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="ml-auto">
                        <button
                          onClick={() => handleVoteComment(comment.id)}
                          className={`flex items-center text-sm transition-colors ${hasVoted ? 'text-red-500' : 'text-zinc-500 hover:text-red-500'}`}
                        >
                          <Heart className={`w-4 h-4 ${hasVoted ? 'fill-current' : ''}`} strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                    {deletingCommentId === comment.id && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setDeletingCommentId(null)}
                          className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-800 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Confirm Delete
                        </button>
                      </div>
                    )}
                    {currentUserId === comment.user_id && !deletingCommentId && (
                      <button
                        onClick={() => setDeletingCommentId(comment.id)}
                        className="text-xs text-red-500 hover:underline mt-2"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-zinc-500">
                <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-zinc-400" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-semibold text-zinc-500">No comments yet</p>
                <p className="text-xs text-zinc-400">Be the first to share your thoughts!</p>
              </div>
            )}
            {comments.length > 0 && (
              <div className="flex items-center gap-2 py-4 px-2 justify-center">
                <MessageCircle className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                <span className="text-xs text-zinc-400 font-medium">Join the conversation — add your comment below</span>
              </div>
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Comment input */}
          <div className="border-t border-black/5 dark:border-white/5 p-4 bg-zinc-50 dark:bg-zinc-900">
            <div className="flex gap-3">
              <div className="shrink-0">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                  {currentUserProfile?.avatar_url && (
                    <img 
                      src={currentUserProfile.avatar_url.startsWith('http') ? currentUserProfile.avatar_url : `${MEDIA_PROXY_BASE}/avatars/${currentUserProfile.avatar_url}`}
                      alt={currentUserProfile.full_name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <textarea
                  ref={commentInputRef}
                  value={newComment}
                  onChange={handleCommentChange}
                  placeholder="Add a comment..."
                  className="w-full bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-2xl px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={1}
                />
                {showMentions && mentionResults.length > 0 && (
                  <div className="bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden">
                    {mentionResults.map((result) => (
                      <button
                        key={result.username}
                        onClick={() => selectMention(result.username)}
                        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-left"
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0">
                          {result.avatar_url && (
                            <img 
                              src={`${MEDIA_PROXY_BASE}/avatars/${result.avatar_url}`}
                              alt={result.full_name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold">{result.full_name}</p>
                          <p className="text-xs text-zinc-500">@{result.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleSubmitComment}
                  disabled={submittingComment || !newComment.trim()}
                  className="self-end px-4 py-2 bg-blue-500 text-white rounded-full text-sm font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submittingComment ? <Loader centered={false} className="text-current" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showPostMenuSheet && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/20 dark:bg-black/40 backdrop-blur-sm"
              onClick={() => setShowPostMenuSheet(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 z-[70] max-w-xl mx-auto bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom,16px)]"
            >
              <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mt-3 mb-2" />
              <div className="px-2 py-2">
                {currentUserId === user_id && (
                  <>
                    <button 
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowPostMenuSheet(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-4 text-base font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-2xl"
                    >
                      <Trash2 size={20} strokeWidth={1.5} />
                      Delete Post
                    </button>
                  </>
                )}
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(content);
                    toast.success('Post text copied');
                    setShowPostMenuSheet(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-4 text-base font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-2xl"
                >
                  <Copy size={20} strokeWidth={1.5} />
                  Copy Text
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

          <Drawer open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DrawerContent className="bg-zinc-100 dark:bg-zinc-900 border-black/10 dark:border-white/10 pb-8 rounded-t-3xl">
              <div className="mx-auto w-full max-w-xl">
                <div className="py-6 px-4 space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-bold">Delete this post?</h3>
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
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 px-4 py-3 text-base font-bold bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    >
                      {deleting ? <Loader centered={false} className="text-current" /> : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            </DrawerContent>
          </Drawer>

          <AnimatePresence>
            {selectedCommentMenu && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[70] bg-black/20 dark:bg-black/40 backdrop-blur-sm"
                  onClick={() => setSelectedCommentMenu(null)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  className="fixed bottom-0 left-0 right-0 z-[80] max-w-xl mx-auto bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom,16px)]"
                >
                  <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mt-3 mb-2" />
                  <div className="px-2 py-2">
                    <button 
                      onClick={() => {
                        const comment = comments.find(c => c.id === selectedCommentMenu) || 
                                       comments.flatMap(c => c.replies || []).find(r => r.id === selectedCommentMenu);
                        if (comment) {
                          navigator.clipboard.writeText(comment.content);
                          toast.success('Comment copied');
                        }
                        setSelectedCommentMenu(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-4 text-base font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-2xl"
                    >
                      <Copy size={20} strokeWidth={1.5} />
                      Copy Text
                    </button>
                    {(comments.find(c => c.id === selectedCommentMenu)?.user_id === currentUserId || 
                      comments.flatMap(c => c.replies || []).find(r => r.id === selectedCommentMenu)?.user_id === currentUserId) && (
                      <button 
                        onClick={() => {
                          setDeletingCommentId(selectedCommentMenu);
                          setSelectedCommentMenu(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-4 text-base font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-2xl"
                      >
                        <Trash2 size={20} strokeWidth={1.5} />
                        Delete Comment
                      </button>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
    </div>
  );
}
