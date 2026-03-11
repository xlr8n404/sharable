'use client';

import { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, MoreVertical, X, Send, Trash2, Clock, Reply, ChevronDown, ChevronUp, Bookmark, Copy, Download, Maximize2, Repeat, TrendingUp, CornerRightDown } from 'lucide-react';
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

const SUPABASE_STORAGE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/public';

interface PostCardProps {
  id: string;
  user_id: string;
  user: {
    full_name: string;
    avatar_url: string;
    username?: string;
  };
  content: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  media_urls?: string[];
  media_types?: string[];
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  reposted_id?: string;
  original_post?: any;
  created_at?: string;
  onDelete?: (postId: string) => void;
  avatarSize?: number;
  isNested?: boolean;
}

interface CommentReply {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user: {
    full_name: string;
    avatar_url: string;
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
    avatar_url: string;
    username?: string;
  };
  replies?: CommentReply[];
  votes_count?: number;
}

export function PostCard({ 
  id, 
  user_id, 
  user, 
  content, 
  media_url, 
  media_type, 
  media_urls = [], 
  media_types = [], 
  likes_count: initialLikes, 
  comments_count: initialComments, 
  reposts_count: initialReposts = 0,
  reposted_id,
  original_post,
  created_at, 
  onDelete, 
  avatarSize = 40,
  isNested = false
}: PostCardProps) {
  const router = useRouter();
  
  // Merge legacy single media into arrays if they exist and arrays are empty
  const finalMediaUrls = media_urls.length > 0 ? media_urls : (media_url ? [media_url] : []);
  const finalMediaTypes = media_types.length > 0 ? media_types : (media_type ? [media_type] : []);
  const hasMedia = finalMediaUrls.length > 0;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [commentsCount, setCommentsCount] = useState(initialComments);
  const [repostsCount, setRepostsCount] = useState(initialReposts);
  const [reposted, setReposted] = useState(false);
  const [showRepostConfirm, setShowRepostConfirm] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
    const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
    const [currentUserProfile, setCurrentUserProfile] = useState<{ full_name: string; avatar_url: string; username?: string } | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
      const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
      const [isSaved, setIsSaved] = useState(false);
      const [mentionResults, setMentionResults] = useState<any[]>([]);
      const [showMentions, setShowMentions] = useState(false);
      const [fullscreenMedia, setFullscreenMedia] = useState<{ url: string; type: string } | null>(null);
        const [scale, setScale] = useState(1);
        const [showHeartAnim, setShowHeartAnim] = useState(false);
        const [viewportHeight, setViewportHeight] = useState<number | null>(null);
        const [votedComments, setVotedComments] = useState<Set<string>>(new Set());
        const [showCommentMenu, setShowCommentMenu] = useState<string | null>(null);
        const commentsEndRef = useRef<HTMLDivElement>(null);

        const scrollToBottom = () => {
          commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        };

        useEffect(() => {
          if (showComments) {
            scrollToBottom();
          }
        }, [comments, showComments]);

          useEffect(() => {
            if (typeof window === 'undefined' || !window.visualViewport) return;

            const handleResize = () => {
              if (window.visualViewport) {
                const newHeight = window.visualViewport.height;
                setViewportHeight(newHeight);
                
                // Only scroll to bottom if keyboard actually opened (height decreased significantly)
                if (newHeight < window.innerHeight * 0.8) {
                  setTimeout(scrollToBottom, 150);
                }
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

        const handlePopState = () => {
          setFullscreenMedia(null);
        };

        if (fullscreenMedia) {
          window.history.pushState({ modal: 'fullscreen' }, '');
          window.addEventListener('popstate', handlePopState);
        }

        return () => {
          window.removeEventListener('popstate', handlePopState);
        };
      }, [!!fullscreenMedia]);

      const closeFullscreen = () => {
        if (fullscreenMedia) {
          if (window.history.state?.modal === 'fullscreen') {
            window.history.back();
          } else {
            setFullscreenMedia(null);
          }
        }
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

      const handleMediaDoubleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowHeartAnim(true);
        setTimeout(() => setShowHeartAnim(false), 1000);
        
        if (!liked && currentUserId) {
          await handleLike();
        } else if (!currentUserId) {
          toast.error('Please login to like posts');
        }
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
    
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 0);
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
    if (showComments && commentInputRef.current) {
      // Focus when comments open to trigger keyboard on mobile
      commentInputRef.current.focus();
    }
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

    const handleSharePost = async () => {
      const shareData = {
        title: 'Sharable Post',
        text: content,
        url: window.location.origin + (user.username ? `/user/${user.username}` : '') + `?post=${id}`,
      };

      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(shareData.url);
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
          a.download = `sharable-${id}-${i + 1}.${type === 'video' ? 'mp4' : 'jpg'}`;
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
    if (avatarPath) return `${SUPABASE_STORAGE_URL}/avatars/${avatarPath}`;
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'User')}`;
  };

  const avatarSrc = user?.avatar_url 
    ? getAvatarUrl(user.avatar_url, user.full_name) 
    : getAvatarUrl(null, user?.full_name || 'User');

  useEffect(() => {
    async function checkStatus() {
      if (!id) return;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;
        
        setCurrentUserId(authUser.id);
        
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, username')
            .eq('id', authUser.id)
            .maybeSingle();
          if (profile) setCurrentUserProfile(profile);
        
        // Check like status
        const { data: likeData } = await supabase
          .from('likes')
          .select('id')
          .eq('user_id', authUser.id)
          .eq('post_id', id)
          .maybeSingle();
        
        setLiked(!!likeData);

        // Check repost status
        const { data: repostData } = await supabase
          .from('reposts')
          .select('id')
          .eq('user_id', authUser.id)
          .eq('post_id', id)
          .maybeSingle();
        
        setReposted(!!repostData);

        // Check save status
        const { data: saveData } = await supabase
          .from('saved_posts')
          .select('id')
          .eq('user_id', authUser.id)
          .eq('post_id', id)
          .maybeSingle();
        
        setIsSaved(!!saveData);
      } catch (err) {
        console.error('Error in checkStatus:', err);
      }
    }
    
    checkStatus();
  }, [id, user_id]);

  useEffect(() => {
    if (!id) return;
    
    const channel = supabase
      .channel(`post-updates:${id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'posts',
        filter: `id=eq.${id}`
      }, (payload) => {
        if (payload.new) {
          setLikesCount(payload.new.likes_count);
          setCommentsCount(payload.new.comments_count);
          setRepostsCount(payload.new.reposts_count);
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

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
          await supabase
            .from('likes')
            .insert({ user_id: currentUserId, post_id: id });
          
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
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        user_id,
        parent_id,
        user:profiles(full_name, avatar_url, username)
      `)
      .eq('post_id', id)
      .order('created_at', { ascending: true });
    
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

      // Sort comments by votes (highest first), then by created_at
      topLevel.sort((a, b) => {
        const voteDiff = (b.votes_count || 0) - (a.votes_count || 0);
        if (voteDiff !== 0) return voteDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setComments(topLevel);
    }
    setLoadingComments(false);
  };

  const handleOpenComments = () => {
    setShowComments(true);
    loadComments();
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
        setComments(prev => prev.map(c => 
          c.id === commentId ? { ...c, votes_count: (c.votes_count || 1) - 1 } : c
        ));
      }
    } else {
      // Add vote
      const { error } = await supabase
        .from('comment_votes')
        .insert({ comment_id: commentId, user_id: currentUserId });

      if (!error) {
        setVotedComments(prev => new Set([...prev, commentId]));
        setComments(prev => prev.map(c => 
          c.id === commentId ? { ...c, votes_count: (c.votes_count || 0) + 1 } : c
        ));
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
          // Extract the path after /public/posts/
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

  function CommentItem({ comment, isReply, parentId, currentUserId, getAvatarUrl, formatTime, deletingCommentId, setDeletingCommentId, handleDeleteComment, setReplyingTo, setNewComment, commentInputRef, handleVoteComment, votedComments, showCommentMenu, setShowCommentMenu }: any) {
    const [isExpanded, setIsExpanded] = useState(false);
    const content = comment.content || '';
    const shouldTruncate = content.length > 115;
    const displayedContent = isExpanded || !shouldTruncate ? content : content.slice(0, 115);
    const hasVoted = votedComments?.has(comment.id);

    return (
      <div className={`flex gap-4 ${isReply ? 'ml-8' : ''}`}>
        <div className="w-10 h-10 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-200 dark:bg-zinc-800 flex-shrink-0">
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
          {/* Name row — no three dot menu here */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-base">{comment.user.full_name || comment.user.username || 'User'}</span>
            <VerifiedBadge username={comment.user.username} className="w-4 h-4 text-white" />
            <span className="text-zinc-500 text-base">{formatTime(comment.created_at)}</span>
          </div>

          {/* Content */}
          <div 
            onClick={() => shouldTruncate && setIsExpanded(!isExpanded)}
            className={`${shouldTruncate ? 'cursor-pointer' : ''} group/comment-content`}
          >
            <p className="text-base text-zinc-700 dark:text-zinc-300 mt-0.5 whitespace-pre-wrap">
              <MentionText text={displayedContent} />
              {shouldTruncate && !isExpanded && <span>...</span>}
              {shouldTruncate && (
                <span className="ml-1 font-bold text-black dark:text-white group-hover/comment-content:underline">
                  {isExpanded ? ' See less' : ' See more'}
                </span>
              )}
            </p>
          </div>

          {/* Actions row — TrendingUp | Reply | three dot menu on right */}
          <div className="flex items-center gap-3 mt-1">
            {/* TrendingUp — only for main comments */}
            {!isReply && (
              <button
                onClick={() => handleVoteComment(comment.id)}
                className={`flex items-center gap-1 text-base transition-colors ${
                  hasVoted 
                    ? 'text-green-500' 
                    : 'text-zinc-500 hover:text-green-500'
                }`}
              >
                <TrendingUp className={`w-6 h-6 ${hasVoted ? 'fill-green-500/20' : ''}`} strokeWidth={1.5} />
                {(comment.votes_count || 0) > 0 && <span>{comment.votes_count}</span>}
              </button>
            )}

            {/* Reply button */}
            <button
              onClick={() => {
                const username = (comment.user as any)?.username;
                setReplyingTo({ 
                  id: isReply ? (parentId || comment.id) : comment.id, 
                  name: username ? `@${username}` : (comment.user?.full_name || 'User') 
                });
                setNewComment(username ? `@${username} ` : '');
                setTimeout(() => {
                  if (commentInputRef.current) {
                    commentInputRef.current.focus();
                    const len = commentInputRef.current.value.length;
                    commentInputRef.current.setSelectionRange(len, len);
                  }
                }, 10);
              }}
              className="flex items-center gap-1 text-base text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
            >
              <Reply className="w-6 h-6" strokeWidth={1.5} />
              Reply
            </button>

            {/* Three dot menu — pushed to the right */}
            <div className="ml-auto relative">
              {deletingCommentId === comment.id ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                  <button
                    onClick={() => setDeletingCommentId(null)}
                    className="text-base font-medium text-zinc-500 hover:text-black dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleDeleteComment(comment.id, isReply, parentId);
                      setDeletingCommentId(null);
                    }}
                    className="text-base font-medium text-red-500 hover:text-red-600"
                  >
                    Confirm
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowCommentMenu(showCommentMenu === comment.id ? null : comment.id)}
                    className="p-1.5 text-zinc-400 hover:text-black dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <MoreVertical className="w-6 h-6" strokeWidth={1.5} />
                  </button>
                  {showCommentMenu === comment.id && (
                    <div className="absolute right-0 bottom-full mb-1 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-xl shadow-xl z-20 overflow-hidden min-w-[140px]">
                      {currentUserId === comment.user_id && (
                        <button
                          onClick={() => {
                            setDeletingCommentId(comment.id);
                            setShowCommentMenu(null);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-500/10 transition-colors text-left"
                        >
                          <Trash2 className="w-5 h-5" strokeWidth={1.5} />
                          <span className="text-base font-medium">Delete</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(comment.content);
                          toast.success('Comment copied');
                          setShowCommentMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                      >
                        <Copy className="w-5 h-5" strokeWidth={1.5} />
                        <span className="text-base font-medium">Copy</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderComment = (comment: Comment | CommentReply, isReply: boolean = false, parentId?: string) => {
    if (!comment || !comment.user) return null;
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
      />
    );
  };

  if (reposted_id && !isNested) {
    const originalPostData = Array.isArray(original_post) ? original_post[0] : original_post;
    
    // If we have a reposted_id but no original_post data (deleted or failed join)
    if (!originalPostData) {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-white dark:bg-black overflow-hidden border-b border-black/[0.05] dark:border-white/[0.05] p-4"
        >
          <div className="flex items-center gap-2 text-zinc-500 italic">
            <Repeat className="w-4 h-4" />
            <span>Original post is no longer available</span>
          </div>
        </motion.div>
      );
    }

    const originalUser = originalPostData.user || { full_name: 'Unknown User', avatar_url: null, username: 'unknown' };
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-white dark:bg-black overflow-hidden border-b border-black/[0.05] dark:border-white/[0.05]"
      >
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
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[18px] tracking-tight truncate">{user?.full_name || user?.username || 'Unknown User'}</span>
                  <VerifiedBadge username={user?.username} />
                </div>
              </div>
            </div>
          <button 
            onClick={() => setShowMenu(true)}
            className="p-2 -mr-2 text-zinc-500 hover:text-black dark:hover:text-white rounded-full transition-colors"
          >
            <MoreVertical className="w-6 h-6" strokeWidth={1.5} />
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
              <DrawerContent className="bg-zinc-100 dark:bg-zinc-900 border-black/10 dark:border-white/10 pb-8 rounded-t-[30px]">
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
                    <div className="flex items-center gap-4 px-4 py-4 text-zinc-500 border-b border-black/5 dark:border-white/5 mb-2">
                      <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                        <Clock className="w-5 h-5" strokeWidth={1.5} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Originally posted on</span>
                        <span className="text-base font-medium text-black dark:text-white">{originalPostData.created_at ? formatFullDate(originalPostData.created_at) : 'Unknown'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                      {/* Save Original */}
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
                            .eq('post_id', originalPostData.id)
                            .maybeSingle();
                          
                          if (existing) {
                            await supabase.from('saved_posts').delete().eq('id', existing.id);
                            toast.success('Removed from saved');
                          } else {
                            await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: originalPostData.id });
                            toast.success('Post saved');
                          }
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-4 px-4 py-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                          <Bookmark className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <span className="text-lg font-bold">Save original post</span>
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
                          const url = window.location.origin + (originalUser.username ? `/user/${originalUser.username}` : '') + `?post=${originalPostData.id}`;
                          if (navigator.share) {
                            await navigator.share({ title: 'Sharable Post', text: originalPostData.content, url });
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
      </motion.div>
    );
  }

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full bg-white dark:bg-black overflow-hidden ${isNested ? '' : 'border-b border-black/[0.05] dark:border-white/[0.05]'}`}
      >
          {!isNested && (
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <Link href={user?.username ? `/user/${user.username}` : '#'} className="flex items-center gap-2 min-w-0">
                <div 
                  className="rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900 flex-shrink-0"
                  style={{ width: avatarSize, height: avatarSize }}
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[18px] tracking-tight truncate">{user?.full_name || user?.username || 'Unknown User'}</span>
                    <VerifiedBadge username={user?.username} />
                  </div>
                </div>
              </Link>
              
              <div className="relative flex-shrink-0 flex items-center gap-2">
                <button 
                  onClick={() => setShowMenu(true)}
                  className="p-2 -mr-2 text-zinc-500 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  <MoreVertical className="w-6 h-6" strokeWidth={1.5} />
                </button>
                
                    <Drawer open={showMenu} onOpenChange={(open) => { setShowMenu(open); if(!open) setShowDeleteConfirm(false); }}>
                      <DrawerContent className="bg-zinc-100 dark:bg-zinc-900 border-black/10 dark:border-white/10 pb-8 rounded-t-[30px]">
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
                          {/* Post Timing */}
                          <div className="flex items-center gap-4 px-4 py-4 text-zinc-500 border-b border-black/5 dark:border-white/5 mb-2">
                            <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                              <Clock className="w-5 h-5" strokeWidth={1.5} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Posted on</span>
                              <span className="text-base font-medium text-black dark:text-white">{created_at ? formatFullDate(created_at) : 'Unknown'}</span>
                            </div>
                          </div>
  
                          <div className="grid grid-cols-1 gap-1">
                            {/* Save */}
                            <button
                              onClick={handleSavePost}
                              className="w-full flex items-center gap-4 px-4 py-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors text-left"
                            >
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSaved ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                                <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} strokeWidth={1.5} />
                              </div>
                              <span className="text-lg font-bold">{isSaved ? 'Saved' : 'Save post'}</span>
                            </button>
  
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
  
                            {/* Download */}
                            {hasMedia && (
                              <button
                                onClick={handleDownloadMedia}
                                className="w-full flex items-center gap-4 px-4 py-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors text-left"
                              >
                                <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                                  <Download className="w-5 h-5" strokeWidth={1.5} />
                                </div>
                                <span className="text-lg font-bold">Download {finalMediaTypes[0] === 'video' ? 'video' : 'photo'}</span>
                              </button>
                            )}
  
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
              <div className="px-4 pb-2">
                {finalMediaUrls.length > 1 ? (
                  <Carousel className="w-full" opts={{ align: "start", dragFree: true }}>
                    <CarouselContent className="-ml-2">
                      {finalMediaUrls.map((url, index) => (
                        <CarouselItem key={index} className="pl-2 basis-[85%] sm:basis-[45%]">
                          <div 
                            className="relative rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-black/[0.05] dark:border-white/[0.05] cursor-pointer group"
                            onClick={() => setFullscreenMedia({ url, type: finalMediaTypes[index] })}
                            onDoubleClick={handleMediaDoubleClick}
                          >
                            <AspectRatio ratio={1 / 1}>
                              {finalMediaTypes[index] === 'video' ? (
                                <video 
                                  src={url} 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <img 
                                  src={url} 
                                  alt={`Post content ${index + 1}`} 
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </AspectRatio>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                              <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                            </div>
                            <AnimatePresence>
                              {showHeartAnim && (
                                <motion.div
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: [0, 1.2, 1], opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ duration: 0.5 }}
                                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                                >
                                  <Heart className="w-20 h-20 text-red-500 fill-current drop-shadow-2xl" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                ) : (
                  <div 
                    className="relative w-full rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-black/[0.05] dark:border-white/[0.05] cursor-pointer group"
                    onClick={() => setFullscreenMedia({ url: finalMediaUrls[0], type: finalMediaTypes[0] })}
                    onDoubleClick={handleMediaDoubleClick}
                  >
                    {finalMediaTypes[0] === 'video' ? (
                      <video 
                        src={finalMediaUrls[0]} 
                        controls 
                        className="w-full h-auto block"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={handleMediaDoubleClick}
                      />
                    ) : (
                      <img 
                        src={finalMediaUrls[0]} 
                        alt="Post content" 
                        className="w-full h-auto block"
                      />
                    )}
                    {finalMediaTypes[0] !== 'video' && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <Maximize2 className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                      </div>
                    )}
                    <AnimatePresence>
                      {showHeartAnim && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: [0, 1.2, 1], opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.5 }}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                        >
                          <Heart className="w-24 h-24 text-red-500 fill-current drop-shadow-2xl" />
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                      onClick={() => setShowRepostConfirm(true)}
                      className={`flex items-center gap-1.5 p-2 rounded-full group transition-colors ${
                        reposted ? 'text-green-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10'
                      }`}
                    >
                      <Repeat className={`w-6 h-6 group-active:rotate-180 transition-transform ${reposted ? 'stroke-[2.5px]' : ''}`} strokeWidth={1.5} />
                      <span className="text-base font-medium">{repostsCount}</span>
                    </button>
                  </div>
                  <button 
                    onClick={handleSharePost}
                    className="p-2 -mr-2 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors group"
                  >
                    <Share2 className="w-6 h-6 group-active:rotate-12 transition-transform" strokeWidth={1.5} />
                  </button>
                </div>
          </motion.div>
    
                <Drawer open={showRepostConfirm} onOpenChange={setShowRepostConfirm}>
                  <DrawerContent className="bg-zinc-100 dark:bg-zinc-900 border-black/10 dark:border-white/10 pb-8 rounded-t-[30px]">
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
                      className="fixed inset-0 bg-white dark:bg-black z-[60] flex items-end justify-center"
                      onClick={() => { setShowComments(false); setReplyingTo(null); }}
                    >
                        <motion.div
                          layout="position"
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
                            transition={{ type: 'spring', damping: 25, stiffness: 300, mass: 0.5 }}
                            onClick={(e) => e.stopPropagation()}
                              style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
                                className="w-full max-w-xl bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white flex flex-col relative rounded-t-[30px] overflow-hidden shadow-2xl pt-10"
                              >
                                {/* Pull Bar */}
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full cursor-grab active:cursor-grabbing" />
                                
                                {/* Comment Sheet Header */}
                                <div className="flex items-center justify-between px-4 pb-3 border-b border-black/5 dark:border-white/5">
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1 text-zinc-500">
                                      <Heart className="w-6 h-6" strokeWidth={1.5} />
                                      <span className="text-base font-medium">{likesCount}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-zinc-500">
                                      <MessageCircle className="w-6 h-6" strokeWidth={1.5} />
                                      <span className="text-base font-medium">{commentsCount}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-zinc-500">
                                      <Repeat className="w-6 h-6" strokeWidth={1.5} />
                                      <span className="text-base font-medium">{repostsCount}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button className="p-2 text-zinc-500 hover:text-black dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                      <CornerRightDown className="w-6 h-6" strokeWidth={1.5} />
                                    </button>
                                    <button 
                                      onClick={handleSharePost}
                                      className="p-2 text-zinc-500 hover:text-black dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    >
                                      <Share2 className="w-6 h-6" strokeWidth={1.5} />
                                    </button>
                                  </div>
                                </div>

                        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 overscroll-contain touch-pan-y custom-scrollbar">
                      {loadingComments ? (
                        <Loader />
                      ) : comments.length > 0 ? (
                        comments.map((comment) => (
                          <div key={comment.id} className="space-y-2">
                            {renderComment(comment)}
                            
                            {comment.replies && comment.replies.length > 0 && (
                              <div className="ml-8">
                                <button
                                  onClick={() => toggleReplies(comment.id)}
                                  className="flex items-center gap-1 text-[16px] text-zinc-500 hover:text-black dark:hover:text-white transition-colors mb-2"
                                >
                                  {expandedReplies.has(comment.id) ? (
                                    <ChevronUp className="w-6 h-6" strokeWidth={1.5} />
                                  ) : (
                                    <ChevronDown className="w-6 h-6" strokeWidth={1.5} />
                                  )}
                                  {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                                </button>
                                {expandedReplies.has(comment.id) && (
                                  <div className="space-y-3">
                                    {comment.replies.map((reply) => renderComment(reply, true, comment.id))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-zinc-500">
                          No comments yet. Be the first to comment!
                        </div>
                      )}
                      <div ref={commentsEndRef} />
                    </div>

                          <div className="bg-zinc-100 dark:bg-zinc-900 pb-[env(safe-area-inset-bottom,16px)]">
                          {replyingTo && (
                            <div className="flex items-center justify-between py-2 px-4 border-b border-black/5 dark:border-white/5">
                              <span className="text-base text-zinc-500">
                                Replying to <span className="font-bold text-black dark:text-white">{replyingTo.name}</span>
                              </span>
                              <button
                                onClick={() => setReplyingTo(null)}
                                className="p-1 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                              >
                                <X className="w-5 h-5" strokeWidth={1.5} />
                              </button>
                            </div>
                          )}
                        <div className="min-h-16 flex items-center px-4 py-3 relative">
                          <div className="flex items-center gap-3 w-full">
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
                            className="flex-1 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white px-5 py-2.5 rounded-full text-[16px] outline-none placeholder-zinc-500 resize-none min-h-[42px] max-h-32"
                          />
                          <button
                            onClick={handleSubmitComment}
                            disabled={submittingComment || !newComment.trim()}
                            className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${
                              submittingComment || !newComment.trim()
                                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600'
                                : 'bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200'
                            }`}
                          >
                            {submittingComment ? (
                              <Loader centered={false} className="text-current" />
                            ) : (
                              <Send className="w-6 h-6" strokeWidth={1.5} />
                            )}
                          </button>
                        </div>
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
                className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center overflow-hidden"
                onClick={closeFullscreen}
              >
                <div className="absolute top-6 right-6 flex items-center gap-4 z-[110]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const a = document.createElement('a');
                      a.href = fullscreenMedia.url;
                      a.download = `shareit-${id}.${fullscreenMedia.type === 'video' ? 'mp4' : 'jpg'}`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md border border-white/10"
                  >
                    <Download className="w-6 h-6" strokeWidth={1.5} />
                  </button>
                  <button 
                    onClick={closeFullscreen}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md border border-white/10"
                  >
                    <X className="w-6 h-6" strokeWidth={1.5} />
                  </button>
                </div>
              
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="w-full h-full flex items-center justify-center relative touch-none"
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
                        alt="Fullscreen content" 
                        className={`w-full h-full object-contain ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
                      />
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

    </>
  );
}
