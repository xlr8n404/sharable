'use client';

// ── Feature flag ── set to true when Stories is ready to launch
const STORIES_ENABLED = false;

import { useNavBack } from '@/components/NavigationHistoryProvider';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { ArrowLeft, Share2, ImagePlus, UserCircle, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

const MEDIA_PROXY_BASE = '/api/media';

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

const COLOR_PALETTE = [
  { label: 'White', value: '#ffffff', text: '#18181b' },
  { label: 'Black', value: '#18181b', text: '#ffffff' },
  { label: 'Green', value: '#16a34a', text: '#ffffff' },
  { label: 'Red', value: '#dc2626', text: '#ffffff' },
  { label: 'Blue', value: '#2563eb', text: '#ffffff' },
  { label: 'Pastel Pink', value: '#f9a8d4', text: '#18181b' },
  { label: 'Coral', value: '#fb923c', text: '#ffffff' },
];

export default function CreateStoryPage() {
  const router = useRouter();
  const { goBack } = useNavBack();

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

  const [profile, setProfile] = useState<any>(null);
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[1]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (data) setProfile(data);
    }
    loadProfile();
  }, [router]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleShare = async () => {
    if (!profile) return;
    if (!content.trim() && !photoFile) {
      toast.error('Add some text or a photo to your story');
      return;
    }
    setSubmitting(true);

    try {
      let photoUrl: string | null = null;

      if (photoFile) {
        // Ensure the 'stories' bucket exists (creates it if missing)
        await fetch('/api/setup/storage', { method: 'GET' });

        const ext = photoFile.name.split('.').pop();
        const filePath = `${profile.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('stories')
          .upload(filePath, photoFile, { upsert: true });

        if (uploadError) throw uploadError;
        photoUrl = filePath;
      }

      const { error } = await supabase.from('stories').insert({
        user_id: profile.id,
        content: content.trim(),
        bg_color: selectedColor.value,
        photo_url: photoUrl,
      });

      if (error) throw error;

      toast.success('Story shared!');
      router.push('/stories');
    } catch (err: any) {
      toast.error(err.message || 'Failed to share story');
    } finally {
      setSubmitting(false);
    }
  };

  const avatarSrc = getAvatarUrl(profile?.avatar_url, profile?.full_name || 'User');

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: photoPreview ? '#000' : selectedColor.value }}
    >
      {/* Background photo */}
      {photoPreview && (
        <img
          src={photoPreview}
          alt="Story photo"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {/* Overlay for readability */}
      {photoPreview && <div className="absolute inset-0 bg-black/30" />}

      {/* Top Bar */}
      <div className="relative z-10 flex items-center px-4 pt-12 pb-4 gap-3">
        <button
          onClick={() => goBack()}
          className="p-1 rounded-full text-white hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={24} strokeWidth={2} />
        </button>

        {/* Profile picture */}
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/60 bg-zinc-700 flex-shrink-0">
          {profile?.avatar_url ? (
            <img src={avatarSrc} alt={profile.full_name} className="w-full h-full object-cover" />
          ) : (
            <UserCircle size={40} strokeWidth={1} className="text-zinc-400 w-full h-full" />
          )}
        </div>

        {/* Name + username */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="font-bold text-[16px] leading-tight truncate"
              style={{ color: photoPreview ? '#fff' : selectedColor.text }}
            >
              {profile?.full_name || profile?.username || 'User'}
            </span>
            <VerifiedBadge
              username={profile?.username}
              className={`w-4 h-4 flex-shrink-0 ${photoPreview ? 'text-white' : ''}`}
            />
            <span
              className="text-sm opacity-70 truncate"
              style={{ color: photoPreview ? '#fff' : selectedColor.text }}
            >
              @{profile?.username}
            </span>
          </div>
        </div>

        {/* Share button */}
        <button
          onClick={handleShare}
          disabled={submitting}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm transition-all disabled:opacity-50"
          style={{
            backgroundColor: photoPreview ? 'rgba(255,255,255,0.9)' : selectedColor.text,
            color: photoPreview ? '#18181b' : selectedColor.value,
          }}
        >
          <Share2 size={16} strokeWidth={2} />
          {submitting ? 'Sharing...' : 'Share'}
        </button>
      </div>

      {/* Content area — text input */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-8">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write something..."
          maxLength={500}
          className="w-full bg-transparent text-center text-2xl font-semibold resize-none outline-none placeholder-white/50 leading-snug"
          style={{
            color: photoPreview ? '#fff' : selectedColor.text,
            textShadow: photoPreview ? '0 1px 6px rgba(0,0,0,0.7)' : 'none',
          }}
          rows={4}
        />
      </div>

      {/* Right side: Photo icon (vertical) */}
      <div className="absolute right-4 bottom-36 z-10 flex flex-col gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoSelect}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-12 h-12 rounded-2xl bg-black/30 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/50 transition-colors"
        >
          <ImagePlus size={22} strokeWidth={1.5} />
        </button>
      </div>

      {/* Bottom: Color palette */}
      <div className="relative z-10 px-4 pb-10 pt-4">
        <div className="flex items-center justify-center gap-3">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color.value}
              onClick={() => setSelectedColor(color)}
              className="transition-transform"
              style={{ transform: selectedColor.value === color.value ? 'scale(1.25)' : 'scale(1)' }}
            >
              <div
                className="rounded-full border-2 transition-all"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: color.value,
                  borderColor: selectedColor.value === color.value ? '#fff' : 'rgba(255,255,255,0.3)',
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
