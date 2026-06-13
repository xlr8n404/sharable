'use client';
import { useNavBack } from '@/components/NavigationHistoryProvider';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Image as ImageIcon, Music, X, Type, AtSign,
  Smile, Sticker, Hash, MapPin, Settings2,
  Users, UserCheck, Globe, MessageCircle, Loader as LoaderIcon,
} from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { searchGifs, insertStickerAtCursor, insertGifAtCursor, getAllStickers, getStickersByCategory, getStickerCategories, type StickerCategory, type GifResult } from '@/lib/sticker-utils';
import { getCurrentLocation, reverseGeocode, searchLocations, type LocationResult } from '@/lib/location-utils';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string;
  username?: string;
}

type Audience    = 'Anyone' | 'Followers' | 'Following';
type CommentPerm = 'Anyone' | 'Followers' | 'Following' | 'Mentioned';

export default function CreatePostPage() {
  const router = useRouter();
  const { goBack } = useNavBack();

  const [profile,       setProfile]       = useState<Profile | null>(null);
  const [content,       setContent]       = useState('');
  const [heading,       setHeading]       = useState('');
  const [headingActive, setHeadingActive] = useState(false);
  const [mediaFiles,    setMediaFiles]    = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [posting,       setPosting]       = useState(false);
  const [mentionResults,setMentionResults]= useState<any[]>([]);
  const [showMentions,  setShowMentions]  = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [showStickers,  setShowStickers]  = useState(false);
  const [showLocation,  setShowLocation]  = useState(false);
  const [stickerTab,      setStickerTab]      = useState<'stickers' | 'gifs'>('stickers');
  const [stickerSearch,   setStickerSearch]   = useState('');
  const [stickerCategory, setStickerCategory] = useState<StickerCategory>('smileys');
  const [filteredStickers,setFilteredStickers]= useState<string[]>([]);
  const [gifResults,      setGifResults]      = useState<GifResult[]>([]);
  const [gifLoading,      setGifLoading]      = useState(false);
  const [location,        setLocation]        = useState('');
  const [locationSearch,  setLocationSearch]  = useState('');
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedCoords,  setSelectedCoords]  = useState<{ lat: number; lon: number } | null>(null);
  const [audience,        setAudience]        = useState<Audience>('Anyone');
  const [commentPerm,     setCommentPerm]     = useState<CommentPerm>('Anyone');
  const [reviewReplies,   setReviewReplies]   = useState(false);

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const audioInputRef  = useRef<HTMLInputElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const headingRef     = useRef<HTMLInputElement>(null);

  // ── Fetch profile ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username')
        .eq('id', user.id)
        .single();
      if (data) setProfile(data);
      setLoading(false);
    })();
  }, [router]);

  // ── Initialize stickers when sheet opens
  useEffect(() => {
    if (showStickers && stickerTab === 'stickers') {
      const stickers = getStickersByCategory(stickerCategory);
      setFilteredStickers(stickers);
    }
  }, [showStickers, stickerTab, stickerCategory]);

  // ── Search stickers
  useEffect(() => {
    if (stickerTab === 'stickers' && showStickers) {
      if (stickerSearch.trim()) {
        const allStickers = getAllStickers();
        setFilteredStickers(allStickers);
      } else {
        const stickers = getStickersByCategory(stickerCategory);
        setFilteredStickers(stickers);
      }
    }
  }, [stickerSearch, stickerTab, stickerCategory, showStickers]);

  // ── Search GIFs
  useEffect(() => {
    if (stickerTab === 'gifs' && showStickers) {
      const searchQuery = stickerSearch.trim();
      if (searchQuery) {
        setGifLoading(true);
        searchGifs(searchQuery).then((results) => {
          setGifResults(results);
          setGifLoading(false);
        });
      } else {
        setGifLoading(true);
        searchGifs('').then((results) => {
          setGifResults(results);
          setGifLoading(false);
        });
      }
    }
  }, [stickerSearch, stickerTab, showStickers]);

  // ── Search locations
  useEffect(() => {
    if (showLocation && locationSearch.trim()) {
      setLocationLoading(true);
      searchLocations(locationSearch).then((results) => {
        setLocationResults(results);
        setLocationLoading(false);
      });
    } else {
      setLocationResults([]);
    }
  }, [locationSearch, showLocation]);

  const avatarSrc = profile?.avatar_url
    ? `/api/media/avatars/${profile.avatar_url}`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.full_name ?? 'default'}`;

  // ── Mention detection ───────────────────────────────────────────────────────
  const handleTextChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    const before = value.substring(0, e.target.selectionStart);
    const lastWord = before.split(/\s/).pop() ?? '';
    if (lastWord.startsWith('@') && lastWord.length > 1) {
      const q = lastWord.slice(1);
      const { data } = await supabase
        .from('profiles')
        .select('username, full_name, avatar_url')
        .ilike('username', `${q}%`)
        .limit(5);
      if (data?.length) { setMentionResults(data); setShowMentions(true); }
      else setShowMentions(false);
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (username: string) => {
    if (!textareaRef.current) return;
    const pos    = textareaRef.current.selectionStart;
    const before = content.substring(0, pos);
    const after  = content.substring(pos);
    const words  = before.split(/\s/);
    words[words.length - 1] = `@${username} `;
    setContent(words.join(' ') + after);
    setShowMentions(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const insertMentionSymbol = () => {
    if (!textareaRef.current) return;
    const pos    = textareaRef.current.selectionStart;
    const before = content.substring(0, pos);
    const after  = content.substring(pos);
    const sep    = before.length > 0 && !before.endsWith(' ') ? ' @' : '@';
    setContent(before + sep + after);
    setTimeout(() => {
      if (textareaRef.current) {
        const next = pos + sep.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(next, next);
      }
    }, 0);
  };

  // ── Heading toggle ──────────────────────────────────────────────────────────
  const toggleHeading = () => {
    setHeadingActive(prev => {
      if (!prev) setTimeout(() => headingRef.current?.focus(), 50);
      return !prev;
    });
  };

  // ── Media compression & selection ──────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const slots = 3 - mediaFiles.length;
    if (slots <= 0) return;
    const toProcess = files.slice(0, slots);
    const loadingId = toast.loading('Processing media…');
    const processed: File[] = [];
    try {
      for (const file of toProcess) {
        if (file.type.startsWith('image/')) {
          // Compress to max 800 KB, max 1080 px, convert to WebP
          const comp = await imageCompression(file, {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1080,
            useWebWorker: true,
            fileType: 'image/webp',
            initialQuality: 0.82,
          });
          processed.push(new File([comp], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }));
        } else {
          // video / audio — accept as-is
          processed.push(file);
        }
      }
      if (processed.length) {
        const newFiles = [...mediaFiles, ...processed];
        mediaPreviews.forEach(u => URL.revokeObjectURL(u));
        setMediaFiles(newFiles);
        setMediaPreviews(newFiles.map(f => URL.createObjectURL(f)));
        toast.success('Media added', { id: loadingId });
      } else {
        toast.dismiss(loadingId);
      }
    } catch {
      toast.error('Failed to process media', { id: loadingId });
    }
  };

  const removeMedia = (i: number) => {
    URL.revokeObjectURL(mediaPreviews[i]);
    setMediaFiles(prev => prev.filter((_, idx) => idx !== i));
    setMediaPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (!content.trim() && !mediaFiles.length) { toast.error('Add some content or media'); return; }
    if (!profile) return;
    setPosting(true);
    try {
      const mediaUrls: string[] = [];
      const mediaTypes: string[] = [];
      for (const file of mediaFiles) {
        const res = await fetch('/api/upload/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, fileType: file.type, bucket: 'posts' }),
        });
        if (!res.ok) { const { error } = await res.json(); throw new Error(error || 'Presign failed'); }
        const { signedUrl, publicUrl } = await res.json();
        const up = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!up.ok) throw new Error('Upload failed');
        mediaUrls.push(publicUrl);
        mediaTypes.push(file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image');
      }
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id:     profile.id,
          content:     content.trim(),
          media_url:   mediaUrls[0]  ?? null,
          media_type:  mediaTypes[0] ?? null,
          media_urls:  mediaUrls.length  ? mediaUrls  : null,
          media_types: mediaTypes.length ? mediaTypes : null,
          location_name: location || null,
          location_latitude: selectedCoords?.lat ?? null,
          location_longitude: selectedCoords?.lon ?? null,
        })
        .select('id, post_number')
        .single();
      if (postError) throw postError;
      toast.success('Post shared!');
      // Notifications (non-blocking)
      const postId = postData?.id ?? null;
      void (async () => {
        try {
          const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', profile!.id);
          if (!followers?.length) return;
          await supabase.from('notifications').insert(followers.map((f: any) => ({ user_id: f.follower_id, from_user_id: profile!.id, type: 'post', post_id: postId, read: false })));
          followers.forEach((f: any) => fetch('/api/push-notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: f.follower_id, title: profile!.full_name || profile!.username || 'Someone', body: content.trim().slice(0, 100) || 'Shared a new post', url: `/post/${postId}` }) }).catch(() => {}));
        } catch { /* ignore */ }
      })();
      router.push('/home');
    } catch (err) {
      console.error('[create-post]', err);
      toast.error('Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const isPostDisabled = posting || (!content.trim() && !mediaFiles.length);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <Skeleton className="h-4 w-24 bg-zinc-100 dark:bg-zinc-900" />
          </div>
          <Skeleton className="h-9 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </header>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ─── Top bar 64px ──────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center gap-3 px-4 bg-background border-b border-black/5 dark:border-white/5">
        {/* Back arrow 24px */}
        <button
          onClick={() => goBack()}
          className="p-2 -ml-2 rounded-full text-foreground hover:bg-black/8 dark:hover:bg-white/8 transition-colors shrink-0"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        {/* Avatar 40px */}
        <div className="w-10 h-10 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900 shrink-0">
          <img
            src={avatarSrc}
            alt={profile?.full_name ?? 'User'}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'; }}
          />
        </div>

        {/* Full name */}
        <span className="flex-1 text-[15px] font-semibold truncate">{profile?.full_name}</span>

        {/* Post pill button */}
        <button
          onClick={handlePost}
          disabled={isPostDisabled}
          className={`px-5 h-9 rounded-full text-sm font-bold transition-all shrink-0 ${
            isPostDisabled
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
              : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-80 active:scale-95'
          }`}
        >
          {posting ? <Loader centered={false} className="text-current" /> : 'Post'}
        </button>
      </header>

      {/* ─── Scrollable body ───────────────────────────────────────────────── */}
      <main className="flex-1 pt-16 pb-32 px-4 overflow-y-auto">
        {/* Heading field */}
        {headingActive && (
          <div className="pt-4 pb-1">
            <input
              ref={headingRef}
              type="text"
              maxLength={115}
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="Add a heading…"
              className="w-full bg-transparent text-foreground text-[18px] font-bold placeholder-zinc-400 dark:placeholder-zinc-600 outline-none border-b border-black/10 dark:border-white/10 pb-2"
            />
            <p className="text-right text-[11px] text-zinc-400 mt-1">{heading.length}/115</p>
          </div>
        )}

        {/* Mention dropdown */}
        <div className="relative">
          {showMentions && (
            <div className="absolute top-0 left-0 right-0 z-20 bg-background border border-black/10 dark:border-white/10 rounded-xl shadow-xl overflow-hidden mt-1">
              {mentionResults.map((u) => (
                <button
                  key={u.username}
                  onClick={() => selectMention(u.username)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800 shrink-0">
                    <img
                      src={u.avatar_url ? `/api/media/avatars/${u.avatar_url}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.full_name}`}
                      alt={u.full_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-none">{u.full_name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Main textarea — 16px text */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextChange}
            placeholder="What's on your mind?"
            className="w-full bg-transparent text-foreground text-[16px] placeholder-zinc-400 dark:placeholder-zinc-600 resize-none outline-none min-h-[200px] pt-4"
            autoFocus
          />
        </div>

        {/* Media previews */}
        {mediaPreviews.length > 0 && (
          <div className={`grid gap-2 mb-4 ${mediaPreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {mediaPreviews.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                {mediaFiles[i]?.type.startsWith('video/') ? (
                  <video src={src} className="w-full h-full object-cover" controls />
                ) : mediaFiles[i]?.type.startsWith('audio/') ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
                    <Music className="w-10 h-10 text-zinc-400" />
                    <span className="text-xs text-zinc-500 truncate w-full text-center px-2">{mediaFiles[i].name}</span>
                    <audio src={src} controls className="w-full" />
                  </div>
                ) : (
                  <img src={src} alt="Preview" className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => removeMedia(i)}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full text-white hover:bg-black transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ─── Bottom toolbar 64px ───────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 h-16 flex items-center px-2 bg-background">
        <input ref={fileInputRef}  type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />
        <input ref={audioInputRef} type="file" accept="audio/*"         multiple onChange={handleFileSelect} className="hidden" />

        {/* Left side: Gallery, Stickers, Music */}
        <div className="flex items-center gap-0 flex-1">
          {/* Gallery */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={mediaFiles.length >= 3}
            title="Gallery"
            className="p-2.5 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-foreground hover:bg-black/8 dark:hover:bg-white/8 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ImageIcon className="w-6 h-6" />
          </button>

          {/* Stickers */}
          <button
            title="Stickers"
            onClick={() => setShowStickers(true)}
            className="p-2.5 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-foreground hover:bg-black/8 dark:hover:bg-white/8 transition-colors"
          >
            <Sticker className="w-6 h-6" />
          </button>

          {/* Music */}
          <button
            onClick={() => audioInputRef.current?.click()}
            disabled={mediaFiles.length >= 3}
            title="Music"
            className="p-2.5 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-foreground hover:bg-black/8 dark:hover:bg-white/8 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Music className="w-6 h-6" />
          </button>
        </div>

        {/* Right side: Location, Settings */}
        <div className="flex items-center gap-0 flex-1 justify-end">
          {/* Location */}
          <button
            title="Location"
            onClick={() => setShowLocation(true)}
            className="p-2.5 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-foreground hover:bg-black/8 dark:hover:bg-white/8 transition-colors"
          >
            <MapPin className="w-6 h-6" />
          </button>

          {/* Post settings */}
          <button
            onClick={() => setShowSettings(true)}
            title="Post settings"
            className="p-2.5 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-foreground hover:bg-black/8 dark:hover:bg-white/8 transition-colors"
          >
            <Settings2 className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* ─── Settings bottom sheet ─────────────────────────────────────────── */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={() => setShowSettings(false)} />
          <div className="relative bg-background rounded-t-2xl px-4 pt-4 pb-10 space-y-0 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/20 mx-auto mb-4" />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[18px] font-bold">Post options</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="px-5 py-1.5 rounded-full bg-black dark:bg-white text-white dark:text-black font-bold text-[14px] active:scale-95 transition-transform"
              >
                Done
              </button>
            </div>

            {/* Who can see this post */}
            <div className="mb-6">
              <p className="text-[13px] font-medium text-zinc-500 mb-3">Who can see this post</p>
              <div className="space-y-0">
                {(['Anyone', 'Followers'] as Audience[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAudience(opt)}
                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-black/5 dark:border-white/5 last:border-b-0"
                  >
                    <span className="text-[16px] font-medium">{opt === 'Followers' ? 'Your followers' : opt}</span>
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        audience === opt
                          ? 'bg-black dark:bg-white border-black dark:border-white'
                          : 'border-zinc-300 dark:border-zinc-700'
                      }`}
                    >
                      {audience === opt && (
                        <div className="w-2 h-2 rounded-full bg-white dark:bg-black" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Who can comment on this post */}
            <div className="mb-6">
              <p className="text-[13px] font-medium text-zinc-500 mb-3">Who can comment on this post</p>
              <div className="space-y-0">
                {(['Anyone', 'Followers', 'Following', 'Mentioned'] as CommentPerm[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setCommentPerm(opt)}
                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-black/5 dark:border-white/5 last:border-b-0"
                  >
                    <span className="text-[16px] font-medium">
                      {opt === 'Followers' ? 'Your followers' : opt === 'Following' ? 'Profiles you follow' : opt === 'Mentioned' ? 'Profiles that you mention' : opt}
                    </span>
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        commentPerm === opt
                          ? 'bg-black dark:bg-white border-black dark:border-white'
                          : 'border-zinc-300 dark:border-zinc-700'
                      }`}
                    >
                      {commentPerm === opt && (
                        <div className="w-2 h-2 rounded-full bg-white dark:bg-black" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>


          </div>
        </div>
      )}

      {/* ─── Stickers & GIFs Sheet ─────────────────────────────────────────── */}
      {showStickers && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={() => setShowStickers(false)} />
          <div className="relative bg-background rounded-t-2xl px-4 pt-4 pb-10 shadow-2xl max-h-[80vh] flex flex-col">
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/20 mx-auto mb-4" />
            
            {/* Tabs */}
            <div className="flex gap-4 mb-4 border-b border-black/5 dark:border-white/5">
              <button
                onClick={() => setStickerTab('stickers')}
                className={`pb-3 font-medium text-[14px] transition-colors relative ${
                  stickerTab === 'stickers'
                    ? 'text-foreground'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Stickers
                {stickerTab === 'stickers' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
                )}
              </button>
              <button
                onClick={() => setStickerTab('gifs')}
                className={`pb-3 font-medium text-[14px] transition-colors relative ${
                  stickerTab === 'gifs'
                    ? 'text-foreground'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                GIFs
                {stickerTab === 'gifs' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
                )}
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                placeholder={`Search ${stickerTab === 'stickers' ? 'stickers' : 'GIFs'}...`}
                value={stickerSearch}
                onChange={(e) => setStickerSearch(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[14px] placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </div>

            {/* Stickers Tab */}
            {stickerTab === 'stickers' && (
              <div className="flex-1 overflow-y-auto">
                <div className="flex gap-2 mb-4 pb-3 border-b border-black/5 dark:border-white/5 overflow-x-auto">
                  {getStickerCategories().map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setStickerCategory(cat)}
                      className={`px-3 py-1 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                        stickerCategory === cat
                          ? 'bg-black dark:bg-white text-white dark:text-black'
                          : 'bg-zinc-100 dark:bg-zinc-900 text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
                {filteredStickers.length > 0 ? (
                  <div className="grid grid-cols-6 gap-2">
                    {filteredStickers.map((sticker, idx) => (
                      <button
                        key={`${stickerCategory}-${idx}`}
                        onClick={() => {
                          if (textareaRef.current) {
                            insertStickerAtCursor(textareaRef.current, sticker, content, setContent);
                            setShowStickers(false);
                          }
                        }}
                        className="aspect-square flex items-center justify-center text-2xl hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                        title={`Insert ${sticker}`}
                      >
                        {sticker}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    <p className="text-[14px]">No stickers found</p>
                  </div>
                )}
              </div>
            )}
            {stickerTab === 'gifs' && (
              <div className="flex-1 overflow-y-auto">
                {gifLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <LoaderIcon className="w-6 h-6 animate-spin text-zinc-400" />
                  </div>
                ) : gifResults.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {gifResults.map((gif) => (
                      <button
                        key={gif.id}
                        onClick={() => {
                          if (textareaRef.current) {
                            insertGifAtCursor(textareaRef.current, gif.images.fixed_height.url, gif.title, content, setContent);
                            setShowStickers(false);
                          }
                        }}
                        className="relative group overflow-hidden rounded-lg aspect-video bg-zinc-100 dark:bg-zinc-900 hover:opacity-80 transition-opacity"
                        title={gif.title}
                      >
                        <img
                          src={gif.images.fixed_height.url}
                          alt={gif.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Add</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    <p className="text-[14px]">No GIFs found</p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowStickers(false)}
              className="w-full h-12 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-[15px] active:scale-95 transition-transform mt-4"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ─── Location Sheet ──────────────────────────────────────────────────── */}
      {showLocation && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={() => setShowLocation(false)} />
          <div className="relative bg-background rounded-t-2xl px-4 pt-4 pb-10 shadow-2xl max-h-[80vh] flex flex-col">
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/20 mx-auto mb-4" />
            
            <h3 className="text-[18px] font-bold mb-6">Add location</h3>

            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search locations..."
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[14px] placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </div>

            {/* Location Display */}
            {location && (
              <div className="mb-4 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl">
                <p className="text-[14px] font-medium">{location}</p>
                <button
                  onClick={() => setLocation('')}
                  className="text-[12px] text-zinc-500 hover:text-foreground mt-1"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Current Location Button */}
            <button
              onClick={async () => {
                const coords = await getCurrentLocation();
                if (coords) {
                  const result = await reverseGeocode(coords.latitude, coords.longitude);
                  if (result) {
                    setLocation(result.name);
                    setSelectedCoords({ lat: coords.latitude, lon: coords.longitude });
                  }
                } else {
                  toast.error('Could not get your location');
                }
              }}
              className="w-full mb-4 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[14px] font-medium transition-colors"
            >
              Use Current Location
            </button>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
              {locationLoading ? (
                <div className="flex items-center justify-center h-32">
                  <LoaderIcon className="w-6 h-6 animate-spin text-zinc-400" />
                </div>
              ) : locationResults.length > 0 ? (
                <div className="space-y-2">
                  {locationResults.map((result, idx) => (
                    <button
                      key={`${result.latitude}-${result.longitude}-${idx}`}
                      onClick={() => {
                        setLocation(result.name);
                        setSelectedCoords({ lat: result.latitude, lon: result.longitude });
                        setLocationSearch('');
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-black/5 dark:border-white/5"
                    >
                      <p className="text-[14px] font-medium text-foreground">{result.name}</p>
                      {result.display_name && (
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">{result.display_name}</p>
                      )}
                    </button>
                  ))}
                </div>
              ) : locationSearch.trim() ? (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                  <p className="text-[14px]">No locations found</p>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                  <p className="text-[14px]">Search for a location or use current location</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowLocation(false)}
              className="w-full h-12 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-[15px] active:scale-95 transition-transform mt-4"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
