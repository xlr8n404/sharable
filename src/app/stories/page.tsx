'use client';

// ── Feature flag ── set to true when Stories is ready to launch
const STORIES_ENABLED = false;

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { SquarePen, UserCircle, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface Story {
  id: string;
  user_id: string;
  content: string;
  bg_color: string;
  photo_url?: string | null;
  created_at: string;
  user: {
    full_name: string;
    username: string;
    avatar_url?: string | null;
  };
}

const MEDIA_PROXY_BASE = '/api/media';

// Resolve story photo_url to a proxy URL, handling fallback bucket marker
function getStoryPhotoUrl(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('/api/')) return photoUrl;
  // Fallback: stored in 'posts' bucket under stories/ subfolder
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

export default function StoriesPage() {
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  if (!STORIES_ENABLED) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background">
          <div className="flex items-center px-4 h-full">
            <h1 className="text-xl font-bold tracking-tight">Stories</h1>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center text-center px-8 pt-16 pb-24">
          <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6">
            <BookOpen size={36} strokeWidth={1.5} className="text-zinc-400" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Coming Soon</h2>
          <p className="text-zinc-500 text-base max-w-[280px] leading-relaxed">
            Stories is not available yet. We're working on something great — stay tuned!
          </p>
        </main>
        <BottomNav />
      </div>
    );
  }

  useEffect(() => {
    async function fetchStories() {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          id, user_id, content, bg_color, photo_url, created_at,
          user:profiles(full_name, username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setStories(data as any);
      }
      setLoading(false);
    }
    fetchStories();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Bar — 64px */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background">
        <div className="flex items-center justify-between px-4 h-full">
          <h1 className="text-xl font-bold tracking-tight">Stories</h1>
          <Link
            href="/create/story"
            className="p-2 rounded-xl text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <SquarePen size={24} strokeWidth={1.5} />
          </Link>
        </div>
      </header>

      <main className="w-full pt-16 pb-24 px-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" style={{ aspectRatio: '9/16' }} />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📖</span>
            </div>
            <h3 className="text-xl font-bold mb-2">No stories yet</h3>
            <p className="text-zinc-500 max-w-[240px] mb-6">
              Be the first to share a story!
            </p>
            <Link
              href="/create/story"
              className="px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black font-bold rounded-full text-sm"
            >
              Create Story
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-4">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function StoryCard({ story }: { story: Story }) {
  const avatarSrc = getAvatarUrl(story.user?.avatar_url, story.user?.full_name || 'User');

  return (
    <Link
      href={`/create/story/view?id=${story.id}`}
      className="relative rounded-2xl overflow-hidden group cursor-pointer"
      style={{ aspectRatio: '9/16' }}
    >
      {/* Background */}
      {getStoryPhotoUrl(story.photo_url) ? (
        <img
          src={getStoryPhotoUrl(story.photo_url)!}
          alt="Story"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 w-full h-full" style={{ backgroundColor: story.bg_color || '#18181b' }} />
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

      {/* Content preview */}
      {story.content && (
        <div className="absolute inset-0 flex items-center justify-center px-3">
          <p
            className="text-white text-sm font-medium text-center leading-snug line-clamp-4 drop-shadow-md"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
          >
            {story.content}
          </p>
        </div>
      )}

      {/* Bottom user info */}
      <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 flex items-center gap-2">
        <div className="w-10 h-10 rounded-full border-2 border-white/80 overflow-hidden bg-zinc-700 flex-shrink-0">
          <img
            src={avatarSrc}
            alt={story.user?.full_name || 'User'}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=default`;
            }}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-white text-[13px] font-semibold leading-tight truncate" style={{ fontSize: '13px' }}>
              {story.user?.full_name || story.user?.username || 'User'}
            </p>
            <VerifiedBadge username={story.user?.username} className="w-3.5 h-3.5 text-white flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* Hover shimmer */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-2xl" />
    </Link>
  );
}
