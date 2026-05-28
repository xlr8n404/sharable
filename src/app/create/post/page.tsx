'use client';
import { useNavBack } from '@/components/NavigationHistoryProvider';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Image as ImageIcon, Music, X } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomNav } from '@/components/BottomNav';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string;
  username?: string;
}

export default function CreatePostPage() {
  const isHeaderVisible = useScrollDirection();
  const router = useRouter();
  const { goBack } = useNavBack();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@') && lastWord.length > 1) {
      const query = lastWord.substring(1);
      setMentionQuery(query);
      
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
    if (!textareaRef.current) return;
    
    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = content.substring(0, cursorPosition);
    const textAfterCursor = content.substring(cursorPosition);
    
    const words = textBeforeCursor.split(/\s/);
    words[words.length - 1] = `@${username} `;
    
    const newContent = words.join(' ') + textAfterCursor;
    setContent(newContent);
    setShowMentions(false);
    
    // Maintain focus
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }
      
      setLoading(false);
    }

    fetchProfile();
  }, [router]);

  const avatarSrc = profile?.avatar_url
    ? `/api/media/avatars/${profile.avatar_url}`
    : profile?.full_name
      ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.full_name}`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=default`;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 3 - mediaFiles.length;
    const filesToProcess = files.slice(0, remainingSlots);

    const processedFiles: File[] = [];
    const loadingToast = toast.loading('Processing media...');

    try {
      for (const file of filesToProcess) {
        if (file.type.startsWith('image/')) {
          // Image compression
          const options = {
            maxSizeMB: 1, // Target size 1MB
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };
          const compressedFile = await imageCompression(file, options);
          processedFiles.push(new File([compressedFile], file.name, { type: file.type }));
        } else if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
          // No size or duration limit — accept any video or audio
          processedFiles.push(file);
        }
      }

      if (processedFiles.length > 0) {
        const newFiles = [...mediaFiles, ...processedFiles];
        setMediaFiles(newFiles);

        const newPreviews = newFiles.map(file => URL.createObjectURL(file));
        mediaPreviews.forEach(url => URL.revokeObjectURL(url));
        setMediaPreviews(newPreviews);
        toast.success('Media added successfully', { id: loadingToast });
      } else {
        toast.dismiss(loadingToast);
      }
    } catch {
      toast.error('Failed to process some media', { id: loadingToast });
    }
  };

  const removeMedia = (index: number) => {
    URL.revokeObjectURL(mediaPreviews[index]);
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!content.trim() && mediaFiles.length === 0) {
      toast.error('Please add some content or media');
      return;
    }

    if (!profile) return;

    setPosting(true);

    try {
      let mediaUrls: string[] = [];
      let mediaTypes: string[] = [];

      // Upload media via presigned URL — server auth, client upload, no size limit
      if (mediaFiles.length > 0) {
        for (const file of mediaFiles) {
          // Step 1: get a signed upload URL from the server
          const presignRes = await fetch('/api/upload/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, fileType: file.type, bucket: 'posts' }),
          });

          if (!presignRes.ok) {
            const { error } = await presignRes.json();
            throw new Error(error || 'Failed to get upload URL');
          }

          const { signedUrl, publicUrl } = await presignRes.json();

          // Step 2: upload directly to Supabase Storage via the signed URL
          const uploadRes = await fetch(signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          });

          if (!uploadRes.ok) throw new Error('File upload failed');

          const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image';
          mediaUrls.push(publicUrl);
          mediaTypes.push(type);
        }
      }

      // Save post to the posts table (post_number is auto-incremented by trigger)
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: profile.id,
          content: content.trim(),
          media_url: mediaUrls[0] || null,
          media_type: mediaTypes[0] || null,
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          media_types: mediaTypes.length > 0 ? mediaTypes : null,
        })
        .select('id, post_number')
        .single();

      if (postError) throw postError;

      toast.success('Post shared successfully!');

      // Notify all followers about the new post
      try {
        const postId = postData?.id ?? null;
        // Fetch all followers of the current user
        const { data: followers } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', profile.id);

        if (followers && followers.length > 0) {
          // Insert in-app notifications for each follower
          const notifRows = followers.map((f: any) => ({
            user_id: f.follower_id,
            from_user_id: profile.id,
            type: 'post',
            post_id: postId,
            read: false,
          }));
          await supabase.from('notifications').insert(notifRows);

          // Send push notifications (fire-and-forget)
          for (const f of followers) {
            fetch('/api/push-notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: f.follower_id,
                title: profile.full_name || profile.username || 'Someone',
                body: content.trim() ? content.trim().slice(0, 100) : 'Shared a new post',
                url: `/post/${postId}`,
              }),
            }).catch(() => {});
          }
        }
      } catch {
        // Notification errors should not block the post flow
      }

      // Redirect to home page
      router.push('/home');
    } catch (error) {
      console.error('[v0] Post creation error:', error);
      toast.error('Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const isPostDisabled = posting || (!content.trim() && mediaFiles.length === 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="h-16 flex items-center justify-between px-4 bg-background">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <Skeleton className="h-4 w-24 bg-zinc-100 dark:bg-zinc-900" />
          </div>
          <Skeleton className="h-9 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </header>
        <main className="w-full p-4 space-y-4">
          <Skeleton className="h-32 w-full rounded-xl bg-zinc-100 dark:bg-zinc-900" />
          <div className="flex gap-4">
            <Skeleton className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900" />
            <Skeleton className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900" />
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-background text-foreground selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">
        <header className={`fixed top-0 left-0 right-0 z-50 px-4 h-16 flex items-center justify-between bg-background transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
          <div className="flex items-center gap-3">
            <Link href="/home" className="p-2 -ml-2 text-foreground hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors" onClick={(e) => { e.preventDefault(); goBack(); }}>
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div className="w-10 h-10 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900">
            <img
              src={avatarSrc}
              alt={profile?.full_name || 'User'}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=default`;
              }}
            />
          </div>
          <span className="text-[16px] font-semibold text-foreground truncate max-w-[120px]">
            {profile?.full_name}
          </span>
        </div>
          <button
            onClick={handlePost}
            disabled={isPostDisabled}
              className={`px-5 py-2 font-bold text-sm rounded-full transition-colors ${
                isPostDisabled
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                  : 'bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200'
            }`}
          >
                {posting ? (
                  <Loader centered={false} className="text-current" />
                ) : (
                  'Share'
                )}

          </button>
      </header>

      <main className="w-full pt-16 pb-20 px-4">
        <div className="py-4 relative">
            {showMentions && (
              <div className="absolute top-0 left-0 right-0 -translate-y-full bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden mb-2">
                {mentionResults.map((user) => (
                  <button
                    key={user.username}
                    onClick={() => selectMention(user.username)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800">
                      <img
                        src={user.avatar_url ? `/api/media/avatars/${user.avatar_url}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name}`}
                        alt={user.full_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{user.full_name}</span>
                      <span className="text-xs text-zinc-500">@{user.username}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextChange}
              placeholder="What's on your mind?"
              className="w-full bg-transparent text-foreground text-lg placeholder-zinc-400 dark:placeholder-zinc-600 resize-none outline-none min-h-[120px]"
              autoFocus
            />
        </div>

        {mediaPreviews.length > 0 && (
          <div className={`grid gap-2 mb-4 ${mediaPreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {mediaPreviews.map((preview, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                {mediaFiles[index]?.type.startsWith('video/') ? (
                  <video src={preview} className="w-full h-full object-cover" controls />
                ) : mediaFiles[index]?.type.startsWith('audio/') ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-900 gap-2 p-3">
                    <Music className="w-10 h-10 text-zinc-400" />
                    <span className="text-xs text-zinc-500 text-center truncate w-full px-2">{mediaFiles[index].name}</span>
                    <audio src={preview} controls className="w-full" />
                  </div>
                ) : (
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                )}
                  <button
                    onClick={() => removeMedia(index)}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 dark:bg-black/70 rounded-full hover:bg-black transition-colors text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            ))}
          </div>
        )}

          <div className="border-t border-black/10 dark:border-white/10 pt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={mediaFiles.length >= 3}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-colors ${
                  mediaFiles.length >= 3
                    ? 'border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                    : 'border-black/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20'
              }`}
            >
              <ImageIcon className="w-6 h-6" />
              <span className="text-sm font-medium">Photo/Video</span>
            </button>
            <button
              onClick={() => audioInputRef.current?.click()}
              disabled={mediaFiles.length >= 3}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-colors ${
                  mediaFiles.length >= 3
                    ? 'border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                    : 'border-black/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20'
              }`}
            >
              <Music className="w-6 h-6" />
              <span className="text-sm font-medium">Audio</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
