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
    
    const nextComment = words.join(' ') + textAfterCursor;
    setNewComment(nextComment);
    setShowMentions(false);
    
    // Disabled: Do not auto-focus to prevent scroll-up behavior
    // setTimeout(() => {
    //   commentInputRef.current?.focus();
    // }, 0);
  };

  useEffect(() => {
    if (showComments || showMenu || fullscreenMedia) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, [showComments, showMenu, fullscreenMedia]);

  useEffect(() => {
    // Disabled: Do not auto-focus on comment input to prevent scroll-up behavior
    // if (showComments && commentInputRef.current) {
    //   // Delay focus slightly to allow animation to complete
    //   const timer = setTimeout(() => {
    //     commentInputRef.current?.focus();
    //   }, 350);
    //   return () => clearTimeout(timer);
    // }
  }, [showComments]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(content);
    toast.success('Text copied to clipboard');
    setShowMenu(false);
  };

  const handleSavePost = async () => {
    if (!currentUserId) {
      toast.error('Please login to save posts');
      return;
    }

    const wasSaved = isSaved;
    setIsSaved(!isSaved);
    toast.success(!isSaved ? 'Post saved' : 'Post removed from saved');

    try {
      if (wasSaved) {
        await supabase
          .from('saved_posts')
          .delete()
          .eq('user_id', currentUserId)
          .eq('post_id', id);
      } else {
        await supabase
          .from('saved_posts')
          .insert({ user_id: currentUserId, post_id: id });
      }
    } catch (error) {
      setIsSaved(wasSaved);
      toast.error('Failed to update saved post');
    }
    setShowMenu(false);
  };

    const generateShareLink = () => {
      // Create short unique link: @username + random 6 chars
      const randomChars = Math.random().toString(36).substring(2, 8);
      return `${window.location.origin}/${user.username}/${randomChars}`;
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
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          return updated;
        });
        toast.success('Ranked!');
      } else {
        toast.error(error.message || 'Could not rank this comment');
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
      const insertData: any = {
        user_id: currentUserId,
        post_id: id,
        content: newComment.trim(),
      };

      if (replyingTo) {
        insertData.parent_id = replyingTo.id;
      }

        const { data, error } = await supabase
          .from('comments')
          .insert(insertData)
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

      const newCommentData = data as any;

      if (replyingTo) {
        setComments(prev => prev.map(c => {
          if (c.id === replyingTo.id) {
            return {
              ...c,
              replies: [...(c.replies || []), {
                id: newCommentData.id,
                content: newCommentData.content,
                created_at: newCommentData.created_at,
                user_id: newCommentData.user_id,
                user: newCommentData.user,
              }],
            };
          }
          return c;
        }));
        setExpandedReplies(prev => new Set(prev).add(replyingTo.id));
      } else {
        setComments(prev => [...prev, {
          id: newCommentData.id,
          content: newCommentData.content,
          created_at: newCommentData.created_at,
          user_id: newCommentData.user_id,
          user: newCommentData.user,
          replies: [],
        }]);
      }

      if (!replyingTo) {
        setCommentsCount(prev => prev + 1);
        await supabase
          .from('posts')
          .update({ comments_count: commentsCount + 1 })
          .eq('id', id);
      }

        setNewComment('');
        setReplyingTo(null);
        
        // Reset textarea height
        if (commentInputRef.current) {
          commentInputRef.current.style.height = 'auto';
        }

        // Disabled: Do not auto-scroll to bottom when user posts a comment
        // setTimeout(scrollToBottom, 100);

      if (user_id !== currentUserId) {
        await supabase
          .from('notifications')
          .insert({
            user_id: user_id,
            from_user_id: currentUserId,
            type: 'comment',
            post_id: id,
            comment_id: newCommentData.id,
          });
      }
    } catch (error) {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string, isReply: boolean, parentId?: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      if (isReply && parentId) {
        setComments(prev => prev.map(c => {
          if (c.id === parentId) {
            return {
              ...c,
              replies: (c.replies || []).filter(r => r.id !== commentId),
            };
          }
          return c;
        }));
      } else {
        setComments(prev => prev.filter(c => c.id !== commentId));
        setCommentsCount(prev => prev - 1);
        await supabase
          .from('posts')
          .update({ comments_count: Math.max(0, commentsCount - 1) })
          .eq('id', id);
      }

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
  const avatarSize = isReply ? 32 : 40;
  const nameSize = isReply ? 'text-sm' : 'text-base';
  const timeSize = isReply ? 'text-xs' : 'text-sm';
  
  return (
  <div className={`flex gap-3 ${isReply ? 'ml-8' : ''}`}>
  {/* Profile picture */}
  <div className="flex-shrink-0" style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}>
    <div className="w-full h-full rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-200 dark:bg-zinc-800">
      <img
        src={getAvatarUrl(comment.user.avatar_url, comment.user.full_name)}
        alt={comment.user.full_name || 'User'}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(comment.user.full_name || 'User')}`;
        }}
      />
    </div>
  </div>
  
  <div className="flex-1 min-w-0">
    {/* Header row: name, timing, menu */}
    <div className="flex items-center justify-between gap-2 mb-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`font-bold ${nameSize}`}>{comment.user.full_name || comment.user.username || 'User'}</span>
        <span className={`text-zinc-500 ${timeSize}`}>{formatTime(comment.created_at)}</span>
      </div>
      <button
        onClick={() => setShowCommentMenu(comment.id)}
        className="p-1 text-zinc-500 hover:text-black dark:hover:text-white rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"
      >
        <MoreHorizontal className="w-6 h-6" strokeWidth={1.5} />
      </button>
    </div>
  
    {/* Content */}
    <div
      onClick={() => shouldTruncate && setIsExpanded(!isExpanded)}
      className={`${shouldTruncate ? 'cursor-pointer' : ''} group/comment-content mb-2`}
    >
      <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
        <MentionText text={displayedContent} />
        {shouldTruncate && !isExpanded && <span>...</span>}
        {shouldTruncate && (
          <span className="ml-1 font-bold text-black dark:text-white group-hover/comment-content:underline">
            {isExpanded ? ' See less' : ' See more'}
          </span>
        )}
      </p>
    </div>
    
    {/* Actions row — Reply | Replies */}
    <div className="flex items-center gap-4">
      {/* Reply button */}
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
          {expandedReplies?.has(comment.id) ? '▲' : '▼'} {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
        </button>
      )}
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
    const originalPostData = Array.isArray(original_post) ? original_post[0] : original_post;
    
    // If we have a reposted_id but no original_post data (deleted or failed join)
    if (!originalPostData) {
      return (
        <div className="w-full bg-white dark:bg-black overflow-hidden border-b border-black/[0.05] dark:border-white/[0.05] p-4">
          <div className="flex items-center gap-2 text-zinc-500 italic">
            <Repeat className="w-4 h-4" />
            <span>Original post is no longer available</span>
          </div>
        </div>
      );
    }

    const originalUser = originalPostData.user || { full_name: 'Unknown User', avatar_url: null, username: 'unknown' };

    return (
      <div className="w-full bg-white dark:bg-black overflow-hidden border-b border-black/[0.05] dark:border-white/[0.05]">
        {/* Reposter Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="relative">
                <div 
                  className="rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900 flex-shrink-0"
                  style={{ width: avatarSize, height: avatarSize }}
                >
                  <img 
                    src={avatarSrc} 
                    alt={user?.full_name || 'User'} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.full_name || 'User')}`;
                    }}
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-black dark:bg-white text-white dark:text-black p-0.5 rounded-full border border-white dark:border-black">
                  <Repeat className="w-3 h-3" />
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-[16px] tracking-tight truncate">{user?.full_name || user?.username || 'Unknown User'}</span>
                  <VerifiedBadge username={user?.username} className="w-[16px] h-[16px]" />
                  {user?.identity_tag ? (
                    <span className="text-[14px] px-2.5 py-0.5 bg-primary text-primary-foreground rounded-full font-medium">
                      {user.identity_tag}
                    </span>
                  ) : (
                    <span className="text-[14px] text-zinc-500 dark:text-zinc-400 font-medium">@{user?.username || 'user'}</span>
                  )}
                </div>
              </div>
            </div>
          <button 
            onClick={() => setShowMenu(true)}
            className="p-2 -mr-2 text-zinc-500 hover:text-black dark:hover:text-white rounded-full transition-colors"
          >
            <MoreHorizontal className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </div>

        {/* Original Post Content - Rendered as part of the same flow */}
        <PostCard 
          {...originalPostData}
          user={originalUser}
          isNested={true} 
          avatarSize={avatarSize}
        />

            <Drawer open={showMenu} onOpenChange={(open) => { setShowMenu(open); if(!open) setShowDeleteConfirm(false); }}>
              <DrawerContent className="bg-zinc-100 dark:bg-zinc-900 border-black/10 dark:border-white/10 pb-8 rounded-t-[8px]">
              <div className="mx-auto w-full max-w-xl">
                {showDeleteConfirm ? (
                  <div className="py-6 px-4 space-y-4">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-bold">Delete repost?</h3>
                      <p className="text-zinc-500">Are you sure you want to remove this repost from your profile?</p>
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
                        {deleting ? <Loader centered={false} className="text-white" /> : 'Delete'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col py-4">
                    {/* Original Post Timing */}
                    <div className="flex flex-col gap-4 px-4 py-4 border-b border-black/5 dark:border-white/5 mb-2">
                      {/* Originally posted on */}
                      <div className="flex items-center gap-4 text-zinc-500">
                        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                          <Clock className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Posted on</span>
                          <span className="text-base font-medium text-black dark:text-white">{originalPostData.created_at ? formatFullDate(originalPostData.created_at) : 'Unknown'}</span>
                        </div>
                      </div>

                      {/* Original Creator Info */}
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900">
                          <img
                            src={getAvatarUrl(originalUser?.avatar_url, originalUser?.full_name || 'User')}
                            alt={originalUser?.full_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Posted by</span>
                          <span className="text-base font-bold text-black dark:text-white">{originalUser?.full_name || 'Unknown User'}</span>
                        </div>
                      </div>

                      {/* Reposted on */}
                      <div className="flex items-center gap-4 text-zinc-500">
                        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                          <Clock className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Reposted on</span>
                          <span className="text-base font-medium text-black dark:text-white">{created_at ? formatFullDate(created_at) : 'Unknown'}</span>
                        </div>
                      </div>

                      {/* Reposter Info */}
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900">
                          <img
                            src={getAvatarUrl(user?.avatar_url, user?.full_name || 'User')}
                            alt={user?.full_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Reposted by</span>
                          <span className="text-base font-bold text-black dark:text-white">{user?.full_name || 'Unknown User'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                      {/* Save Repost */}
                      <button
                        onClick={async () => {
                          if (!currentUserId) {
                            toast.error('Please login to save posts');
                            return;
                          }
                          const { data: existing } = await supabase
                            .from('saved_posts')
                            .select('id')
                            .eq('user_id', currentUserId)
                            .eq('post_id', id)
                            .maybeSingle();

                          if (existing) {
                            await supabase.from('saved_posts').delete().eq('id', existing.id);
                            toast.success('Removed from saved');
                          } else {
                            await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: id });
                            toast.success('Repost saved');
                          }
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-4 px-4 py-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                          <Bookmark className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <span className="text-lg font-bold">Save repost</span>
                      </button>

                      {/* Copy Text */}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(originalPostData.content);
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

                      {/* Share Original */}
                      <button
                        onClick={async () => {
                          const randomChars = Math.random().toString(36).substring(2, 8);
                          const url = `${window.location.origin}/${originalUser.username}/${randomChars}`;
                          if (navigator.share) {
                            await navigator.share({ title: 'Sharable Post', text: 'Check out this post on Sharable', url });
                          } else {
                            await navigator.clipboard.writeText(url);
                            toast.success('Link copied');
                          }
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-4 px-4 py-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                          <Share2 className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <span className="text-lg font-bold">Share original post</span>
                      </button>

                      {/* Delete Repost */}
                      {currentUserId === user_id && (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="w-full flex items-center gap-4 px-4 py-4 text-red-500 hover:bg-red-500/10 rounded-2xl transition-colors text-left mt-2 border-t border-black/5 dark:border-white/5"
                        >
                          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                            <Trash2 className="w-5 h-5" strokeWidth={1.5} />
                          </div>
                          <span className="text-lg font-bold">Delete repost</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </DrawerContent>
          </Drawer>
      </div>
    );
  }

  return (
    <>
      <div
        className={`w-full bg-white dark:bg-black overflow-hidden ${isNested ? '' : ''}`}
      >
          {!isNested && (
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <Link href={user?.username ? `/${user.username}` : '#'} className="flex items-center gap-2 min-w-0">
                <div 
                  className="rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900 flex-shrink-0"
                  style={{ width: '40px', height: '40px' }}
                >
                  <img 
                    src={avatarSrc} 
                    alt={user?.username || user?.full_name || 'User'} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'User'}`;
                    }}
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-[16px] tracking-tight truncate">{user?.full_name || user?.username || 'Unknown User'}</span>
                    <VerifiedBadge username={user?.username} className="w-[16px] h-[16px]" />
                    {user?.identity_tag ? (
                      <span className="text-[14px] px-2.5 py-0.5 bg-primary text-primary-foreground rounded-full font-medium">
                        {user.identity_tag}
                      </span>
                    ) : (
                      <span className="text-[14px] text-zinc-500 dark:text-zinc-400 font-medium">@{user?.username || 'user'}</span>
                    )}
                  </div>
                </div>
              </Link>
              
              <div className="relative flex-shrink-0 flex items-center gap-2">
                <button 
                  onClick={() => setShowMenu(true)}
                  className="p-2 -mr-2 text-zinc-500 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  <MoreHorizontal className="w-6 h-6" strokeWidth={1.5} />
                </button>
                
                    <Drawer open={showMenu} onOpenChange={(open) => { setShowMenu(open); if(!open) setShowDeleteConfirm(false); }}>
                      <DrawerContent className="bg-zinc-100 dark:bg-zinc-900 border-black/10 dark:border-white/10 pb-8 rounded-t-[8px]">
                      <div className="mx-auto w-full max-w-xl">
                        {showDeleteConfirm ? (
                          <div className="py-6 px-4 space-y-4">
                          <div className="text-center space-y-2">
                            <h3 className="text-lg font-bold">Delete post?</h3>
                            <p className="text-zinc-500">Are you sure you want to delete this post? This action cannot be undone.</p>
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
                              {deleting ? <Loader centered={false} className="text-white" /> : 'Delete'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col py-4">
                          {/* Post Timing & Creator Info */}
                          <div className="flex flex-col gap-4 px-4 py-4 border-b border-black/5 dark:border-white/5 mb-2">
                            <div className="flex items-center gap-4 text-zinc-500">
                              <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                                <Clock className="w-5 h-5" strokeWidth={1.5} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Posted on</span>
                                <span className="text-base font-medium text-black dark:text-white">{created_at ? formatFullDate(created_at) : 'Unknown'}</span>
                              </div>
                            </div>

                            {/* Creator Info */}
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900">
                                <img 
                                  src={getAvatarUrl(user?.avatar_url, user?.full_name || 'User')} 
                                  alt={user?.full_name} 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Posted by</span>
                                <span className="text-base font-bold text-black dark:text-white">{user?.full_name || 'Unknown User'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-1">

  
                            {/* Copy Text */}
                            <button
                              onClick={handleCopyText}
                              className="w-full flex items-center gap-4 px-4 py-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors text-left"
                            >
                              <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                                <Copy className="w-5 h-5" strokeWidth={1.5} />
                              </div>
                              <span className="text-lg font-bold">Copy text</span>
                            </button>
  

  
                            {/* Share */}
                            <button
                              onClick={handleSharePost}
                              className="w-full flex items-center gap-4 px-4 py-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors text-left"
                            >
                              <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                                <Share2 className="w-5 h-5" strokeWidth={1.5} />
                              </div>
                              <span className="text-lg font-bold">Share post</span>
                            </button>
  
                            {/* Delete */}
                            {currentUserId === user_id && (
                              <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="w-full flex items-center gap-4 px-4 py-4 text-red-500 hover:bg-red-500/10 rounded-2xl transition-colors text-left mt-2 border-t border-black/5 dark:border-white/5"
                              >
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                  <Trash2 className="w-5 h-5" strokeWidth={1.5} />
                                </div>
                                <span className="text-lg font-bold">Delete post</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>
            </div>
          )}
  
            <div className="px-4 pb-2">
                  <div
                    onClick={() => shouldTruncate && setIsExpanded(!isExpanded)}
                    className={`${shouldTruncate ? 'cursor-pointer' : ''} group/content`}
                  >
                    <p className="text-[16px] leading-relaxed text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap">
                      <MentionText text={displayedContent} />
                      {shouldTruncate && !isExpanded && <span>...</span>}
                      {shouldTruncate && (
                        <span className="ml-1 font-bold text-black dark:text-white group-hover/content:underline">
                          {isExpanded ? ' See less' : ' See more'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

            {hasMedia && (
              <div className="rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 mx-4 my-2">
                {/* Facebook-style grid layout */}
                {finalMediaUrls.length === 1 && (
                  <div className="relative w-full h-auto">
                    <MediaGridCell
                      url={finalMediaUrls[0]}
                      type={finalMediaTypes[0]}
                      index={0}
                      isVisible={isVisible}
                      isSingle={true}
                    />
                  </div>
                )}
                {finalMediaUrls.length === 2 && (
                  <div className="grid grid-cols-2 gap-1">
                    {finalMediaUrls.map((url, index) => (
                      <div key={index} className="relative w-full aspect-square">
                        <MediaGridCell
                          url={url}
                          type={finalMediaTypes[index]}
                          index={index}
                          isVisible={isVisible}
                          isSingle={false}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {finalMediaUrls.length === 3 && (
                  <div className="grid gap-1">
                    <div className="relative w-full aspect-video">
                      <MediaGridCell
                        url={finalMediaUrls[0]}
                        type={finalMediaTypes[0]}
                        index={0}
                        isVisible={isVisible}
                        isSingle={false}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {finalMediaUrls.slice(1, 3).map((url, index) => (
                        <div key={index + 1} className="relative w-full aspect-square">
                          <MediaGridCell
                            url={url}
                            type={finalMediaTypes[index + 1]}
                            index={index + 1}
                            isVisible={isVisible}
                            isSingle={false}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {finalMediaUrls.length === 4 && (
                  <div className="grid grid-cols-2 gap-1">
                    {finalMediaUrls.map((url, index) => (
                      <div key={index} className="relative w-full aspect-square">
                        <MediaGridCell
                          url={url}
                          type={finalMediaTypes[index]}
                          index={index}
                          isVisible={isVisible}
                          isSingle={false}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {finalMediaUrls.length >= 5 && (
                  <div className="grid gap-1">
                    <div className="grid grid-cols-2 gap-1">
                      {finalMediaUrls.slice(0, 2).map((url, index) => (
                        <div key={index} className="relative w-full aspect-square">
                          <MediaGridCell
                            url={url}
                            type={finalMediaTypes[index]}
                            index={index}
                            isVisible={isVisible}
                            isSingle={false}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {finalMediaUrls.slice(2, 5).map((url, index) => (
                        <div key={index + 2} className="relative w-full aspect-square">
                          <MediaGridCell
                            url={url}
                            type={finalMediaTypes[index + 2]}
                            index={index + 2}
                            isVisible={isVisible}
                            isSingle={false}
                          />
                        </div>
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
                      className="fixed inset-0 bg-white dark:bg-black z-[60] flex items-end justify-center overflow-hidden"
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
                                className="w-full max-w-xl bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white flex flex-col relative rounded-t-2xl overflow-hidden shadow-2xl pt-10 will-change-transform" onTouchMove={(e) => e.preventDefault()}
  >
  {/* Grabber */}
  <div className="absolute left-1/2 -translate-x-1/2 bg-zinc-300 dark:bg-zinc-700 rounded-full cursor-grab active:cursor-grabbing" style={{ top: '16px', width: '48px', height: '8px' }} />
  
  {/* Comment Sheet Header — fixed h-16 with centered handler and interactions */}
                                <div className="h-16 shrink-0 flex flex-col items-center justify-center border-b border-black/5 dark:border-white/5">
                                  {/* Handler */}
                                  <div className="mb-2" style={{ width: '48px', height: '8px', background: 'currentColor', opacity: 0.2, borderRadius: '999px' }} />
                                  
                                  {/* Interactions - Left side (likes, comments, share) Right side (reposts, save) */}
                                  <div className="w-full flex items-center justify-between px-4">
                                    {/* Left side: likes, comments, share */}
                                    <div className="flex items-center gap-4">
                                      <button
                                        onClick={handleLike}
                                        disabled={liking}
                                        className={`flex items-center gap-1.5 transition-colors disabled:opacity-50 ${liked ? 'text-red-500' : 'text-zinc-500 hover:text-red-500 dark:hover:text-red-400'}`}
                                      >
                                        <Heart className={`w-6 h-6 ${liked ? 'fill-current' : ''}`} strokeWidth={1.5} />
                                      </button>
                                      <button
                                        className="flex items-center gap-1.5 text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                      >
                                        <MessageCircle className="w-6 h-6" strokeWidth={1.5} />
                                      </button>
                                      <button
                                        onClick={handleSharePost}
                                        className="flex items-center gap-1.5 text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                                      >
                                        <Share2 className="w-6 h-6" strokeWidth={1.5} />
                                      </button>
                                    </div>
                                    
                                    {/* Right side: reposts, save, sort */}
                                    <div className="flex items-center gap-4">
                                      <button
                                        onClick={() => setShowRepostConfirm(true)}
                                        disabled={reposting}
                                        className={`flex items-center gap-1.5 transition-colors disabled:opacity-50 ${reposted ? 'text-green-500' : 'text-zinc-500 hover:text-green-500 dark:hover:text-green-400'}`}
                                      >
                                        <Repeat className={`w-6 h-6 ${reposted ? 'stroke-[2.5px]' : ''}`} strokeWidth={1.5} />
                                      </button>
                                      <button
                                        onClick={handleSavePost}
                                        className={`flex items-center gap-1.5 transition-colors ${isSaved ? 'text-black dark:text-white' : 'text-zinc-500 hover:text-black dark:hover:text-white'}`}
                                      >
                                        <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-current' : ''}`} strokeWidth={1.5} />
                                      </button>
                                      <div className="relative">
                                        <button
                                          onClick={() => setShowCommentSortMenu(prev => !prev)}
                                          className={`p-1 rounded-full transition-colors ${showCommentSortMenu ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-zinc-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                                        >
                                          <Settings2 className="w-6 h-6" strokeWidth={1.5} />
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
                          
                          <div className="flex-1 flex items-end gap-2 bg-zinc-200 dark:bg-zinc-800 rounded-full px-4 py-2">
                            <textarea
                              ref={commentInputRef}
                              rows={1}
                              value={newComment}
                              onChange={handleCommentChange}
                              placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : 'Add a comment...'}
                              className="flex-1 bg-transparent text-black dark:text-white text-sm outline-none placeholder-zinc-500 resize-none min-h-[36px] max-h-[90px] leading-snug overflow-y-auto py-1"
                            />
                            
                            <button
                              onClick={handleSubmitComment}
                              disabled={submittingComment || !newComment.trim()}
                              className={`flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${
                                submittingComment || !newComment.trim()
                                  ? 'text-zinc-400 dark:text-zinc-600 opacity-50'
                                  : 'text-black dark:text-white hover:opacity-70'
                              }`}
                            >
                              {submittingComment ? (
                                <Loader centered={false} className="text-current" />
                              ) : (
                                <Send className="w-5 h-5" strokeWidth={1.5} />
                              )}
                            </button>
                          </div>
                        </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Nested Comment Menu Bottom Sheet */}
            <AnimatePresence>
              {showComments && selectedCommentMenu && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/40 z-[70]"
                  onClick={() => setSelectedCommentMenu(null)}
                />
              )}
              {showComments && selectedCommentMenu && (
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'tween', duration: 0.3 }}
                  className="fixed bottom-0 left-0 right-0 z-[80] max-w-xl mx-auto rounded-t-2xl bg-zinc-100 dark:bg-zinc-900 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
  >
  <div className="flex justify-center" style={{ paddingTop: '16px', paddingBottom: '16px' }}>
    <div className="bg-zinc-300 dark:bg-zinc-700 rounded-full" style={{ width: '48px', height: '8px' }} />
  </div>
  
  <div className="px-4 pb-6 space-y-3">
                    {(() => {
                      const comment = comments.find(c => c.id === selectedCommentMenu || c.replies?.find(r => r.id === selectedCommentMenu));
                      const targetComment = comment?.id === selectedCommentMenu ? comment : comment?.replies?.find(r => r.id === selectedCommentMenu);
                      
                      if (!targetComment) return null;
                      
                      return (
                        <>
                          {currentUserId === targetComment.user_id && (
                            <button
                              onClick={() => {
                                setDeletingCommentId(targetComment.id);
                                setSelectedCommentMenu(null);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors text-left font-medium"
                            >
                              <Trash2 className="w-5 h-5" strokeWidth={1.5} />
                              <span>Delete</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(targetComment.content);
                              toast.success('Comment copied');
                              setSelectedCommentMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors text-left font-medium"
                          >
                            <Copy className="w-5 h-5" strokeWidth={1.5} />
                            <span>Copy</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          <AnimatePresence>
            {fullscreenMedia && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden"
                onClick={closeFullscreen}
              >
                {/* Header with user profile, media count, and close button */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 z-[110] flex-shrink-0">
                  {/* Left: User Avatar (40px) */}
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 bg-zinc-900 flex-shrink-0">
                    <img 
                      src={avatarSrc} 
                      alt={user?.username || user?.full_name || 'User'} 
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Middle: Media Count */}
                  <div className="text-white font-medium">
                    {mediaCarouselIndex + 1}/{finalMediaUrls.length}
                  </div>

                  {/* Right: Close Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); closeFullscreen(); }}
                    className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" strokeWidth={1.5} />
                  </button>
                </div>

                {/* Media Container */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden touch-none">
                  {/* Carousel for multiple media */}
                  {finalMediaUrls.length > 1 && (
                    <>
                      {/* Previous button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const prevIndex = mediaCarouselIndex === 0 ? finalMediaUrls.length - 1 : mediaCarouselIndex - 1;
                          setMediaCarouselIndex(prevIndex);
                          setFullscreenMedia({ 
                            url: finalMediaUrls[prevIndex], 
                            type: finalMediaTypes[prevIndex],
                            index: prevIndex
                          });
                          setScale(1);
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md border border-white/10"
                      >
                        <ChevronUp className="w-6 h-6 rotate-90" strokeWidth={2} />
                      </button>

                      {/* Next button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextIndex = mediaCarouselIndex === finalMediaUrls.length - 1 ? 0 : mediaCarouselIndex + 1;
                          setMediaCarouselIndex(nextIndex);
                          setFullscreenMedia({ 
                            url: finalMediaUrls[nextIndex], 
                            type: finalMediaTypes[nextIndex],
                            index: nextIndex
                          });
                          setScale(1);
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md border border-white/10"
                      >
                        <ChevronDown className="w-6 h-6 rotate-90" strokeWidth={2} />
                      </button>
                    </>
                  )}
                
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="w-full h-full flex items-center justify-center relative"
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    {fullscreenMedia.type === 'video' ? (
                      <video 
                        src={fullscreenMedia.url} 
                        controls 
                        autoPlay
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <motion.div
                        className="w-full h-full flex items-center justify-center"
                        initial={{ scale: 1 }}
                        animate={{ scale }}
                        onDoubleClick={() => setScale(s => s === 1 ? 2.5 : 1)}
                      >
                        <motion.img 
                          drag={scale > 1}
                          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                          dragElastic={0}
                          src={fullscreenMedia.url} 
                          alt={`Media ${mediaCarouselIndex + 1}`}
                          className={`w-full h-full object-contain ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
                        />
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

    </>
  );
}
