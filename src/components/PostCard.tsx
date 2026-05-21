'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, X, Send, Trash2, Clock, Reply, ChevronDown, ChevronUp, Bookmark, Copy, Maximize2, Repeat, TrendingUp, CornerRightDown, Settings2, Music, Play, Eye } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MentionText } from '@/components/MentionText';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { AspectRatio } from '@/components/ui/aspect-ratio';
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
function LazyVideo({ src, className, controls, onClick, onDoubleClick }: {
  src: string;
  className?: string;
  controls?: boolean;
  onClick?: (e: React.MouseEvent<HTMLVideoElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLVideoElement>) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

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
      <div className={`${className} bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center`}>
        <Play className="w-10 h-10 text-zinc-400" />
      </div>
    );
  }

  return (
    <video
      ref={ref}
      src={src}
      className={className}
      controls={controls}
      preload="none"
      playsInline
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPlay={handlePlay}
    />
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
          className={`w-full ${isSingle ? 'h-auto max-h-[70vh]' : 'h-full object-cover'}`} 
          controls={isSingle}
        />
      ) : (
        <img
          src={url}
          alt={`Post media ${index + 1}`}
          className={`w-full ${isSingle ? 'h-auto max-h-[70vh] object-contain' : 'h-full object-cover'}`}
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

  const hasMedia = finalMediaUrls.length > 0 && finalMediaUrls[0] !== null && finalMediaUrls[0] !== '';

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
  const [showMenu, setShowMenu] = useState(false);
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
      const [fullscreenMedia, setFullscreenMedia] = useState<{ url: string; type: string; index: number } | null>(null);
        const [scale, setScale] = useState(1);
        const [mediaCarouselIndex, setMediaCarouselIndex] = useState(0);
        const [showHeartAnim, setShowHeartAnim] = useState(false);
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

        useEffect(() => {

      }, [!!fullscreenMedia]);

      const closeFullscreen = () => {
        setFullscreenMedia(null);
      };

      const initialDistance = useRef<number | null>(null);
      const initialScale = useRef(1);
      const commentInputRef = useRef<HTMLTextAreaElement>(null);

      useEffect(() => {
        if (!fullscreenMedia) {
          setScale(1);
          initialDistance.current = null;
        }
      }, [fullscreenMedia]);

      const handleMediaDoubleClick = async (_e: React.MouseEvent) => {
        // double-tap like removed
      };

      const handleTouchStart = (e: React.TouchEvent) => {

      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        initialDistance.current = dist;
        initialScale.current = scale;
      }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 2 && initialDistance.current !== null) {
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        const newScale = (dist / initialDistance.current) * initialScale.current;
        setScale(Math.min(Math.max(1, newScale), 5));
      }
    };

    const handleTouchEnd = () => {
      initialDistance.current = null;
    };


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
          .upsert({ user_id: currentUserId, post_id: id });
        toast.success('Post saved');
      }
    } catch (error) {
      setIsSaved(wasSaved);
      toast.error('Failed to update saved status');
    }
  };

    const generateShareLink = () => {
      if (typeof window === 'undefined') return '';
      return `${window.location.origin}/post/${id}`;
    };

    const handleSharePost = async () => {
      const shareLink = generateShareLink();
      const shareData = {
        title: 'Sharable Post',
        text: 'Check out this post on Sharable',
        url: shareLink,
      };

      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(shareLink);
          toast.success('Link copied to clipboard');
        }
      } catch (err) {
        console.error('Error sharing:', err);
      }
      setShowMenu(false);
    };

    const handleDownloadMedia = async () => {
      if (!hasMedia) return;
      
      try {
        toast.info('Starting download...');
        for (let i = 0; i < finalMediaUrls.length; i++) {
          const url = finalMediaUrls[i];
          const type = finalMediaTypes[i];
          const response = await fetch(url);
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `sharable-${id}-${i + 1}.${type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'jpg'}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(blobUrl);
          document.body.removeChild(a);
        }
        toast.success('Download completed');
      } catch (err) {
        toast.error('Failed to download media');
      }
      setShowMenu(false);
    };

        const shouldTruncate = content.length > 115;
        const displayedContent = isExpanded || !shouldTruncate ? content : content.slice(0, 115);

  const getAvatarUrl = (avatarPath: string | null | undefined, name: string) => {
    if (avatarPath) {
      // If already a full URL (e.g. old data), route through proxy by extracting the path
      if (avatarPath.startsWith('http')) {
        const match = avatarPath.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
        if (match) return `${MEDIA_PROXY_BASE}/${match[1]}/${match[2]}`;
      }
      return `${MEDIA_PROXY_BASE}/avatars/${avatarPath}`;
    }
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'User')}`;
  };

  const avatarSrc = user?.avatar_url 
    ? getAvatarUrl(user.avatar_url, user.full_name) 
    : getAvatarUrl(null, user?.full_name || 'User');

  useEffect(() => {
    // If parent already passed currentUserId + statuses, skip the per-card queries entirely
    if (propCurrentUserId !== undefined) return;

    async function checkStatus() {
      if (!id) return;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        setCurrentUserId(authUser.id);

        if (!propCurrentUserProfile) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, username')
            .eq('id', authUser.id)
            .maybeSingle();
          if (profile) setCurrentUserProfile(profile);
        }

        // Batch like/repost/save checks in parallel
        const [likeRes, repostRes, saveRes] = await Promise.all([
          supabase.from('likes').select('id').eq('user_id', authUser.id).eq('post_id', id).maybeSingle(),
          supabase.from('reposts').select('id').eq('user_id', authUser.id).eq('post_id', id).maybeSingle(),
          supabase.from('saved_posts').select('id').eq('user_id', authUser.id).eq('post_id', id).maybeSingle(),
        ]);

        setLiked(!!likeRes.data);
        setReposted(!!repostRes.data);
        setIsSaved(!!saveRes.data);
      } catch (err) {
        console.error('Error in checkStatus:', err);
      }
    }

    checkStatus();
  }, [id, propCurrentUserId]);

  // Per-card realtime subscriptions removed — the feed-level channel in home/page.tsx
  // already handles UPDATE events and syncs counts without spawning N WebSocket channels.

  useEffect(() => {
    if (!id || !showComments) return;

    const channel = supabase
      .channel(`post-comments:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `post_id=eq.${id}`
      }, () => {
        loadComments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, showComments]);

  const loadComments = async () => {
    setLoadingComments(true);
    let query = supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        user_id,
        parent_id,
        user:profiles(full_name, avatar_url, username)
      `)
      .eq('post_id', id);
    
    if (commentSortOrder === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (commentSortOrder === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else {
      // Ranked - order by most voted (oldest first, but will be reordered by vote count after fetching)
      query = query.order('created_at', { ascending: true });
    }
    
    const { data, error } = await query;
    
    if (!error && data) {
      // Fetch vote counts for all comments
      const commentIds = data.map((c: any) => c.id);
      const { data: votesData } = await supabase
        .from('comment_votes')
        .select('comment_id')
        .in('comment_id', commentIds);
      
      // Count votes per comment
      const voteCountMap: Record<string, number> = {};
      if (votesData) {
        for (const vote of votesData) {
          voteCountMap[vote.comment_id] = (voteCountMap[vote.comment_id] || 0) + 1;
        }
      }

      // Check which comments the current user has voted on
      if (currentUserId) {
        const { data: userVotes } = await supabase
          .from('comment_votes')
          .select('comment_id')
          .eq('user_id', currentUserId)
          .in('comment_id', commentIds);
        
        if (userVotes) {
          setVotedComments(new Set(userVotes.map(v => v.comment_id)));
        }
      }

      const topLevel: Comment[] = [];
      const repliesMap: Record<string, CommentReply[]> = {};

      for (const c of data as any[]) {
        if (c.parent_id) {
          if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = [];
          repliesMap[c.parent_id].push({
            id: c.id,
            content: c.content,
            created_at: c.created_at,
            user_id: c.user_id,
            user: c.user,
          });
        } else {
          topLevel.push({
            id: c.id,
            content: c.content,
            created_at: c.created_at,
            user_id: c.user_id,
            user: c.user,
            replies: [],
            votes_count: voteCountMap[c.id] || 0,
          });
        }
      }

      for (const comment of topLevel) {
        comment.replies = repliesMap[comment.id] || [];
      }

      // Sort comments based on selected order
      if (commentSortOrder === 'newest') {
        // Newest: newest first
        topLevel.sort((a, b) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      } else if (commentSortOrder === 'oldest') {
        // Oldest: oldest first
        topLevel.sort((a, b) => {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      } else {
        // Ranked: by votes (highest first), then by created_at (oldest first)
        topLevel.sort((a, b) => {
          const voteDiff = (b.votes_count || 0) - (a.votes_count || 0);
          if (voteDiff !== 0) return voteDiff;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      }

      setComments(topLevel);
    }
    setLoadingComments(false);
  };

  const handleLike = async () => {
    if (!currentUserId) {
      toast.error('Please login to like posts');
      return;
    }
    if (liking) return;
    setLiking(true);
    const wasLiked = liked;
    setLiked(!liked);
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);
    try {
      if (wasLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', currentUserId)
          .eq('post_id', id);
        await supabase
          .from('posts')
          .update({ likes_count: likesCount - 1 })
          .eq('id', id);
      } else {
          // Check if already liked in DB to prevent duplicates
          const { data: existingLike } = await supabase
            .from('likes')
            .select('id')
            .eq('user_id', currentUserId)
            .eq('post_id', id)
            .maybeSingle();
          if (existingLike) {
            // Already liked — sync local state and bail
            setLiked(true);
            setLikesCount(prev => prev); // no change
            setLiking(false);
            return;
          }
          await supabase
            .from('likes')
            .upsert({ user_id: currentUserId, post_id: id }, { onConflict: 'user_id,post_id', ignoreDuplicates: true });
          // Sync like to Drive
          const driveFormData = new FormData();
          driveFormData.append('type', 'interactions');
          driveFormData.append('metadata', JSON.stringify({ type: 'like', post_id: id, timestamp: new Date().toISOString() }));
          fetch('/api/drive/sync', { method: 'POST', body: driveFormData }).catch(console.error);
          await supabase
            .from('posts')
            .update({ likes_count: likesCount + 1 })
            .eq('id', id);
        if (user_id !== currentUserId) {
          await supabase
            .from('notifications')
            .insert({
              user_id: user_id,
              from_user_id: currentUserId,
              type: 'like',
              post_id: id,
            });
        }
      }
    } catch (error) {
      setLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : prev - 1);
      toast.error('Failed to update like');
    } finally {
      setLiking(false);
    }
  };

  const handleRepost = async () => {
    if (!currentUserId) {
      toast.error('Please login to repost');
      return;
    }
    if (reposting) return;
    setReposting(true);
    try {
      if (reposted) {
        const res = await fetch('/api/repost', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId, post_id: id })
        });
        const data = await res.json();
        if (data.success) {
          setReposted(false);
          setRepostsCount(prev => prev - 1);
          toast.success('Repost removed');
        } else {
          throw new Error(data.error);
        }
      } else {
        const res = await fetch('/api/repost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId, post_id: id })
        });
        const data = await res.json();
          if (data.success) {
            setReposted(true);
            setRepostsCount(prev => prev + 1);
            // Sync repost to Drive
            const driveFormData = new FormData();
            driveFormData.append('type', 'interactions');
            driveFormData.append('metadata', JSON.stringify({ type: 'repost', post_id: id, timestamp: new Date().toISOString() }));
            fetch('/api/drive/sync', { method: 'POST', body: driveFormData }).catch(console.error);
            toast.success('Reposted successfully');
          } else {
          throw new Error(data.error);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update repost');
    } finally {
      setReposting(false);
      setShowRepostConfirm(false);
    }
  };

  const handleOpenComments = () => {
    setShowComments(true);
    loadComments();
  };

  const handleCommentSortChange = (order: 'ranked' | 'newest' | 'oldest') => {
    setCommentSortOrder(order);
    // Reload comments with new sort order
    setTimeout(() => {
      loadComments();
    }, 0);
  };

  const handleVoteComment = async (commentId: string) => {
    if (!currentUserId) {
      toast.error('Please login to vote');
      return;
    }

    const hasVoted = votedComments.has(commentId);
    
    if (hasVoted) {
      // Remove vote
      const { error } = await supabase
        .from('comment_votes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', currentUserId);

      if (!error) {
        setVotedComments(prev => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
        // Update comments (top-level and replies)
        setComments(prev => prev.map(c => {
          if (c.id === commentId) {
            return { ...c, votes_count: Math.max(0, (c.votes_count || 0) - 1) };
          }
          // Also update votes in replies
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map(r => 
                r.id === commentId ? { ...r, votes_count: Math.max(0, (r.votes_count || 0) - 1) } : r
              )
            };
          }
          return c;
        }));
        toast.success('Vote removed');
      } else {
        toast.error(error.message || 'Could not remove vote');
      }
    } else {
      // Add vote
      const { error } = await supabase
        .from('comment_votes')
        .insert({ comment_id: commentId, user_id: currentUserId });

      if (!error) {
        setVotedComments(prev => new Set([...prev, commentId]));
        // Update comments (top-level and replies)
        setComments(prev => {
          const updated = prev.map(c => {
            if (c.id === commentId) {
              return { ...c, votes_count: (c.votes_count || 0) + 1 };
            }
            // Also update votes in replies
            if (c.replies) {
              return {
                ...c,
                replies: c.replies.map(r =>
                  r.id === commentId ? { ...r, votes_count: (r.votes_count || 0) + 1 } : r
                )
              };
            }
            return c;
          });
          // Re-sort comments: by votes (highest first), then by created_at (newest first)
          updated.sort((a, b) => {
            const voteDiff = (b.votes_count || 0) - (a.votes_count || 0);
            if (voteDiff !== 0) return voteDiff;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          return updated;
        });
        toast.success('Vote added');
      } else {
        toast.error(error.message || 'Could not add vote');
      }
    }
  };

  const handleSubmitComment = async () => {
    if (!currentUserId) {
      toast.error('Please login to comment');
      return;
    }

    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: id,
          user_id: currentUserId,
          content: newComment.trim(),
          parent_id: replyingTo?.id || null,
        })
        .select(`
          id,
          content,
          created_at,
          user_id,
          parent_id,
          user:profiles(full_name, avatar_url, username)
        `)
        .single();

      if (error) throw error;

      if (data) {
        if (replyingTo) {
          setComments(prev => prev.map(c => {
            if (c.id === replyingTo.id) {
              return { ...c, replies: [...(c.replies || []), data as any] };
            }
            return c;
          }));
          setExpandedReplies(prev => new Set([...prev, replyingTo.id]));
        } else {
          setComments(prev => [data as any, ...prev]);
        }
        setNewComment('');
        setReplyingTo(null);
        setCommentsCount(prev => prev + 1);
        toast.success('Comment added');
        
        // Notify post owner
        if (user_id !== currentUserId) {
          await supabase
            .from('notifications')
            .insert({
              user_id: user_id,
              from_user_id: currentUserId,
              type: 'comment',
              post_id: id,
              comment_id: data.id,
            });
        }
      }
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string, isReply: boolean = false, parentId?: string) => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      if (isReply && parentId) {
        setComments(prev => prev.map(c => {
          if (c.id === parentId) {
            return { ...c, replies: c.replies?.filter(r => r.id !== commentId) };
          }
          return c;
        }));
      } else {
        setComments(prev => prev.filter(c => c.id !== commentId));
      }
      setCommentsCount(prev => prev - 1);
      toast.success('Comment deleted');
    } catch (error) {
      toast.error('Failed to delete comment');
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = async () => {
    if (!currentUserId || currentUserId !== user_id) {
      toast.error('You can only delete your own posts');
      return;
    }

    setDeleting(true);
    try {
      // Delete media from storage first
      if (finalMediaUrls.length > 0) {
        const filePaths = finalMediaUrls.map(url => {
          // Proxy URLs look like /api/media/posts/user-id/file.jpg
          const proxyMatch = url.match(/^\/api\/media\/posts\/(.+)/);
          if (proxyMatch) return proxyMatch[1];
          // Legacy direct Supabase URL
          const parts = url.split('/public/posts/');
          return parts.length > 1 ? parts[1] : null;
        }).filter(Boolean) as string[];

        if (filePaths.length > 0) {
          await supabase.storage.from('posts').remove(filePaths);
        }
      }

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Post deleted');
      setShowMenu(false);
      if (onDelete) {
        onDelete(id);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error('Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  function CommentItem({ comment, isReply, parentId, currentUserId, getAvatarUrl, formatTime, deletingCommentId, setDeletingCommentId, handleDeleteComment, setReplyingTo, setNewComment, commentInputRef, handleVoteComment, votedComments, showCommentMenu, setShowCommentMenu, replies, expandedReplies, toggleReplies }: any) {
    const [isExpanded, setIsExpanded] = useState(false);
    const content = comment.content || '';
    const shouldTruncate = content.length > 115;
    const displayedContent = isExpanded || !shouldTruncate ? content : content.slice(0, 115);
    const hasVoted = votedComments?.has(comment.id);
    const avatarSize = isReply ? 'w-8 h-8' : 'w-10 h-10';

    return (
      <div className={`flex gap-3 ${isReply ? '' : ''}`}>
        {/* Avatar */}
        <div className={`${avatarSize} rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-200 dark:bg-zinc-800 flex-shrink-0`}>
          <img 
            src={getAvatarUrl(comment.user.avatar_url, comment.user.full_name)} 
            alt={comment.user.full_name || 'User'}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(comment.user.full_name || 'User')}`;
            }}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Header: Name, Timing, Three-dot Menu */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`font-bold ${isReply ? 'text-base' : 'text-base'}`}>{comment.user.full_name || comment.user.username || 'User'}</span>
              <span className="text-zinc-500 text-sm">{formatTime(comment.created_at)}</span>
            </div>
            
            {/* Three-dot Menu */}
            <div className="relative flex-shrink-0">
              {deletingCommentId === comment.id ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                  <button
                    onClick={() => setDeletingCommentId(null)}
                    className="text-xs font-medium text-zinc-500 hover:text-black dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleDeleteComment(comment.id, isReply, parentId);
                      setDeletingCommentId(null);
                    }}
                    className="text-xs font-medium text-red-500 hover:text-red-600"
                  >
                    Confirm
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedCommentMenu(comment.id)}
                  className="p-1 text-zinc-400 hover:text-black dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div 
            onClick={() => shouldTruncate && setIsExpanded(!isExpanded)}
            className={`${shouldTruncate ? 'cursor-pointer' : ''} group/comment-content mt-1`}
          >
            <p className="text-base text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              <MentionText text={displayedContent} />
              {shouldTruncate && !isExpanded && <span>...</span>}
              {shouldTruncate && (
                <span className="ml-1 font-bold text-black dark:text-white group-hover/comment-content:underline">
                  {isExpanded ? ' See less' : ' See more'}
                </span>
              )}
            </p>
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-4 mt-2">
            {/* Left: Reply, Replies */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const username = (comment.user as any)?.username;
                  setReplyingTo({
                    id: isReply ? (parentId || comment.id) : comment.id,
                    name: username ? `@${username}` : (comment.user?.full_name || 'User')
                  });
                  setNewComment(username ? `@${username} ` : '');
                }}
                className="text-sm text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
              >
                Reply
              </button>

              {/* Replies toggle — only for main comments with replies */}
              {!isReply && replies && replies.length > 0 && (
                <button
                  onClick={() => toggleReplies(comment.id)}
                  className="text-sm text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                >
                  {expandedReplies?.has(comment.id) ? 'Hide' : `${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'}`}
                </button>
              )}
            </div>

            {/* Right: Like button */}
            <div className="ml-auto">
              <button
                onClick={() => handleVoteComment(comment.id)}
                className={`flex items-center text-sm transition-colors ${hasVoted ? 'text-red-500' : 'text-zinc-500 hover:text-red-500'}`}
              >
                <Heart className={`w-4 h-4 ${hasVoted ? 'fill-current' : ''}`} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderComment = (comment: Comment | CommentReply, isReply: boolean = false, parentId?: string) => {
    if (!comment || !comment.user) return null;
    const commentWithReplies = comment as Comment;
    return (
      <CommentItem
        key={comment.id}
        comment={comment}
        isReply={isReply}
        parentId={parentId}
        currentUserId={currentUserId}
        getAvatarUrl={getAvatarUrl}
        formatTime={formatTime}
        deletingCommentId={deletingCommentId}
        setDeletingCommentId={setDeletingCommentId}
        handleDeleteComment={handleDeleteComment}
        setReplyingTo={setReplyingTo}
        setNewComment={setNewComment}
        commentInputRef={commentInputRef}
        handleVoteComment={handleVoteComment}
        votedComments={votedComments}
        showCommentMenu={showCommentMenu}
        setShowCommentMenu={setShowCommentMenu}
        replies={commentWithReplies.replies}
        expandedReplies={expandedReplies}
        toggleReplies={toggleReplies}
      />
    );
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
          initialLiked={initialLiked}
          initialReposted={initialReposted}
          initialSaved={initialSaved}
          isVisible={isVisible}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isNested ? 'bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl mx-4 mb-2 border border-black/5 dark:border-white/5' : 'border-b border-black/5 dark:border-white/5'}`}>
      <div className="flex flex-col p-4 pb-2">
        {/* Header: Avatar, Name, Community, More */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
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
            <div className="flex flex-col">
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
              <div className="flex items-center gap-1.5 text-zinc-500 text-[13px]">
                <span className="font-medium">@{user.username || 'user'}</span>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <span>{created_at ? formatTime(created_at) : 'now'}</span>
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
          </div>
          {!isNested && (
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-zinc-400 hover:text-black dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <MoreHorizontal size={20} strokeWidth={1.5} />
              </button>
              
              <AnimatePresence>
                {showMenu && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-30"
                      onClick={() => setShowMenu(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-2xl shadow-xl z-40 overflow-hidden"
                    >
                      <button 
                        onClick={handleSharePost}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <Copy size={18} strokeWidth={1.5} />
                        Copy Link
                      </button>
                      <button 
                        onClick={handleDownloadMedia}
                        disabled={!hasMedia}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                      >
                        <CornerRightDown size={18} strokeWidth={1.5} />
                        Download
                      </button>
                      {currentUserId === user_id && (
                        <button 
                          onClick={() => setShowDeleteConfirm(true)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 size={18} strokeWidth={1.5} />
                          Delete Post
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
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
            {finalMediaUrls.length === 1 ? (
              <MediaGridCell
                url={finalMediaUrls[0]}
                type={finalMediaTypes[0]}
                index={0}
                isVisible={isVisible}
                onOpen={(url, type) => setFullscreenMedia({ url, type, index: 0 })}
                isSingle={true}
              />
            ) : (
              <div className="flex flex-col gap-1">
                {/* Facebook-style Grid Logic */}
                {finalMediaUrls.length === 2 && (
                  <div className="grid grid-cols-2 gap-1 aspect-square">
                    {finalMediaUrls.map((url, index) => (
                      <MediaGridCell
                        key={index}
                        url={url}
                        type={finalMediaTypes[index]}
                        index={index}
                        isVisible={isVisible}
                        onOpen={(url, type) => setFullscreenMedia({ url, type, index })}
                        isSingle={false}
                      />
                    ))}
                  </div>
                )}
                {finalMediaUrls.length === 3 && (
                  <div className="flex flex-col gap-1">
                    <div className="w-full aspect-video">
                      <MediaGridCell
                        url={finalMediaUrls[0]}
                        type={finalMediaTypes[0]}
                        index={0}
                        isVisible={isVisible}
                        onOpen={(url, type) => setFullscreenMedia({ url, type, index: 0 })}
                        isSingle={false}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1 aspect-[2/1]">
                      {finalMediaUrls.slice(1, 3).map((url, index) => (
                        <MediaGridCell
                          key={index + 1}
                          url={url}
                          type={finalMediaTypes[index + 1]}
                          index={index + 1}
                          isVisible={isVisible}
                          onOpen={(url, type) => setFullscreenMedia({ url, type, index: index + 1 })}
                          isSingle={false}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {finalMediaUrls.length === 4 && (
                  <div className="grid grid-cols-2 grid-rows-2 gap-1 aspect-square">
                    {finalMediaUrls.map((url, index) => (
                      <MediaGridCell
                        key={index}
                        url={url}
                        type={finalMediaTypes[index]}
                        index={index}
                        isVisible={isVisible}
                        onOpen={(url, type) => setFullscreenMedia({ url, type, index })}
                        isSingle={false}
                      />
                    ))}
                  </div>
                )}
                {finalMediaUrls.length >= 5 && (
                  <div className="flex flex-col gap-1">
                    <div className="grid grid-cols-2 gap-1 aspect-[2/1]">
                      {finalMediaUrls.slice(0, 2).map((url, index) => (
                        <MediaGridCell
                          key={index}
                          url={url}
                          type={finalMediaTypes[index]}
                          index={index}
                          isVisible={isVisible}
                          onOpen={(url, type) => setFullscreenMedia({ url, type, index })}
                          isSingle={false}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1 aspect-[3/1]">
                      {finalMediaUrls.slice(2, 5).map((url, index) => (
                        <MediaGridCell
                          key={index + 2}
                          url={url}
                          type={finalMediaTypes[index + 2]}
                          index={index + 2}
                          overlay={index === 2 && finalMediaUrls.length > 5 ? finalMediaUrls.length - 5 : 0}
                          isVisible={isVisible}
                          onOpen={(url, type) => setFullscreenMedia({ url, type, index: index + 2 })}
                          isSingle={false}
                        />
                      ))}
                    </div>
                    {finalMediaUrls.length > 5 && (
                      <div className="grid grid-cols-3 gap-1">
                        {finalMediaUrls.slice(5, 8).map((url, index) => (
                          <div key={index + 5} className="relative w-full aspect-square">
                            <MediaGridCell
                              url={url}
                              type={finalMediaTypes[index + 5]}
                              index={index + 5}
                              isVisible={isVisible}
                              isSingle={false}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

            <div className="flex items-center justify-between px-4 pt-0 pb-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-1.5 p-2 -ml-2 rounded-full group transition-colors ${
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
                  className={`flex items-center p-2 -mr-2 rounded-full group transition-colors ${
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
                    className={`flex-1 px-4 py-3 text-base font-bold text-white rounded-2xl transition-colors flex items-center justify-center gap-2 ${
                      reposted ? 'bg-red-500 hover:bg-red-600' : 'bg-black dark:bg-white dark:text-black hover:bg-zinc-800'
                    }`}
                  >
                    {reposting ? <Loader centered={false} className="text-current" /> : (reposted ? 'Remove' : 'Repost')}
                  </button>
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>

          <AnimatePresence>
              {showComments && (
                <motion.div
                  key={`comment-overlay-${id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-background z-[60] flex items-end justify-center overflow-hidden"
                  onClick={() => { setShowComments(false); setReplyingTo(null); }}
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                >                        <motion.div
                      drag="y"
                      dragConstraints={{ top: 0, bottom: 0 }}
                      dragElastic={0.05}
                        onDragEnd={(_, info) => {
                          if (info.offset.y > 100 || info.velocity.y > 300) {
                            setShowComments(false);
                            setReplyingTo(null);
                          }
                        }}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
                        onClick={(e) => e.stopPropagation()}
                          style={{ height: viewportHeight ? `${viewportHeight}px` : '90dvh', WebkitOverflowScrolling: 'touch' }}
                            className="w-full max-w-xl bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white flex flex-col relative rounded-t-[24px] overflow-hidden shadow-2xl will-change-transform" onTouchMove={(e) => e.preventDefault()}
  >
  {/* Grabber — 8px below top border */}
  <div className="flex justify-center pt-2 pb-2">
    <div className="bg-zinc-300 dark:bg-zinc-700 rounded-full cursor-grab active:cursor-grabbing" style={{ width: '48px', height: '8px' }} />
  </div>
  
  {/* Comment Sheet Header — interactions row */}
                                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5">
                                    {/* Left: Like+count, Comment+count, Share */}
                                    <div className="flex items-center gap-4">
                                      <button
                                        onClick={handleLike}
                                        disabled={liking}
                                        className={`flex items-center gap-1 text-sm transition-colors disabled:opacity-50 ${liked ? 'text-red-500' : 'text-zinc-500 hover:text-red-500 dark:hover:text-red-400'}`}
                                      >
                                        <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} strokeWidth={1.5} />
                                        <span className="font-medium">{likesCount}</span>
                                      </button>
                                      <button
                                        className="flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                      >
                                        <MessageCircle className="w-5 h-5" strokeWidth={1.5} />
                                        <span className="font-medium">{commentsCount}</span>
                                      </button>
                                      <button
                                        onClick={handleSharePost}
                                        className="flex items-center text-sm text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                                      >
                                        <Share2 className="w-5 h-5" strokeWidth={1.5} />
                                      </button>
                                    </div>
                                    
                                    {/* Right: Repost+count, Save, Sort */}
                                    <div className="flex items-center gap-4">
                                      <button
                                        onClick={() => setShowRepostConfirm(true)}
                                        disabled={reposting}
                                        className={`flex items-center gap-1 text-sm transition-colors disabled:opacity-50 ${reposted ? 'text-green-500' : 'text-zinc-500 hover:text-green-500 dark:hover:text-green-400'}`}
                                      >
                                        <Repeat className={`w-5 h-5 ${reposted ? 'stroke-[2.5px]' : ''}`} strokeWidth={1.5} />
                                        <span className="font-medium">{repostsCount}</span>
                                      </button>
                                      <button
                                        onClick={handleSavePost}
                                        className={`flex items-center text-sm transition-colors ${isSaved ? 'text-black dark:text-white' : 'text-zinc-500 hover:text-black dark:hover:text-white'}`}
                                      >
                                        <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} strokeWidth={1.5} />
                                      </button>
                                      <div className="relative">
                                        <button
                                          onClick={() => setShowCommentSortMenu(prev => !prev)}
                                          className={`p-1 rounded-full transition-colors ${showCommentSortMenu ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-zinc-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                                        >
                                          <Settings2 className="w-5 h-5" strokeWidth={1.5} />
                                        </button>
                                        <AnimatePresence>
                                          {showCommentSortMenu && (
                                            <>
                                              <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="fixed inset-0 z-[5]"
                                                onClick={() => setShowCommentSortMenu(false)}
                                              />
                                              <motion.div
                                                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.92, y: -4 }}
                                                transition={{ duration: 0.15 }}
                                                className="absolute right-0 top-full mt-1 z-[10] min-w-[140px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl overflow-hidden"
                                              >
                                                {(['ranked', 'newest', 'oldest'] as const).map((option) => (
                                                  <button
                                                    key={option}
                                                    onClick={() => { handleCommentSortChange(option); setShowCommentSortMenu(false); }}
                                                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors text-left ${
                                                      commentSortOrder === option
                                                        ? 'text-black dark:text-white bg-black/5 dark:bg-white/10'
                                                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5'
                                                    }`}
                                                  >
                                                    <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
                                                    {commentSortOrder === option && (
                                                      <span className="w-2 h-2 rounded-full bg-black dark:bg-white ml-3 shrink-0" />
                                                    )}
                                                  </button>
                                                ))}
                                              </motion.div>
                                            </>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    </div>
                                </div>
                                
                                {/* HR separator */}
                                <div className="h-px bg-black/5 dark:bg-white/5" />

                        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 overscroll-contain touch-pan-y custom-scrollbar" onPointerDownCapture={(e) => e.stopPropagation()}>
                      {loadingComments ? (
                        <Loader />
                      ) : comments.length > 0 ? (
                        comments.map((comment) => (
                          <div key={comment.id} className="space-y-2">
                            {renderComment(comment)}
                            {comment.replies && comment.replies.length > 0 && expandedReplies.has(comment.id) && (
                              <div className="ml-8 space-y-3">
                                {comment.replies.map((reply) => renderComment(reply, true, comment.id))}
                              </div>
                            )}
                          </div>
                        ))
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

                          <div className="bg-zinc-100 dark:bg-zinc-900 pb-[env(safe-area-inset-bottom,16px)]">
                        <div className="flex items-end px-4 py-3 gap-3 relative">
                          {/* Mentions dropdown */}
                          {showMentions && (
                            <div className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-100 dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden">
                              {mentionResults.map((user) => (
                                <button
                                  key={user.username}
                                  onClick={() => selectMention(user.username)}
                                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                                >
                                  <div className="w-8 h-8 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-200 dark:bg-zinc-900">
                                    <img
                                      src={getAvatarUrl(user.avatar_url, user.full_name)}
                                      alt={user.full_name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-base font-bold">{user.full_name}</span>
                                    <span className="text-base text-zinc-500">@{user.username}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          
                          {/* Pill-shaped comment input container */}
                          {currentUserProfile && (
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-200 dark:bg-zinc-800 flex-shrink-0">
                              <img
                                src={getAvatarUrl(currentUserProfile.avatar_url, currentUserProfile.full_name)}
                                alt={currentUserProfile.full_name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <textarea
                            ref={commentInputRef}
                            rows={1}
                            value={newComment}
                            onChange={handleCommentChange}
                            placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : 'Add a comment...'}
                            className="flex-1 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white px-4 py-3 rounded-2xl text-[16px] outline-none placeholder-zinc-500 resize-none min-h-[40px] max-h-32 leading-snug overflow-y-auto"
                          />
                          <button
                            onClick={handleSubmitComment}
                            disabled={submittingComment || !newComment.trim()}
                            className={`px-6 py-2 rounded-full font-medium transition-colors flex-shrink-0 text-sm ${
                              submittingComment || !newComment.trim()
                                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600'
                                : 'bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200'
                            }`}
                          >
                            {submittingComment ? (
                              <Loader centered={false} className="text-current" />
                            ) : (
                              'Send'
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
              )}
          </AnimatePresence>

          <AnimatePresence>
            {fullscreenMedia && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center select-none"
                onClick={closeFullscreen}
              >
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
                  <div className="text-white text-sm font-medium">
                    {fullscreenMedia.index + 1} / {finalMediaUrls.length}
                  </div>
                  <button 
                    onClick={closeFullscreen}
                    className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                  <Carousel 
                    className="w-full h-full"
                    setApi={(api) => {
                      if (api) {
                        api.on("select", () => {
                          const index = api.selectedScrollSnap();
                          setMediaCarouselIndex(index);
                          setFullscreenMedia(prev => prev ? { ...prev, index, url: finalMediaUrls[index], type: finalMediaTypes[index] } : null);
                        });
                        api.scrollTo(fullscreenMedia.index, true);
                      }
                    }}
                  >
                    <CarouselContent className="h-full ml-0">
                      {finalMediaUrls.map((url, index) => (
                        <CarouselItem key={index} className="h-full pl-0 flex items-center justify-center">
                          <div 
                            className="relative w-full h-full flex items-center justify-center p-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {finalMediaTypes[index] === 'video' ? (
                              <LazyVideo 
                                src={url} 
                                className="max-w-full max-h-full object-contain" 
                                controls 
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <motion.img
                                src={url}
                                alt="Fullscreen"
                                className="max-w-full max-h-full object-contain cursor-zoom-in"
                                style={{ scale }}
                                drag={scale > 1}
                                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                              />
                            )}
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                </div>
              </motion.div>
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
