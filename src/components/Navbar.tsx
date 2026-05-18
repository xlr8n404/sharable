'use client';

import { Share2, Settings2, MessageCircle, UserCircle } from 'lucide-react';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export function Navbar() {
  const isVisible = useScrollDirection();
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        await fetchUserProfile(session.user.id);
      } else {
        // Fallback to internal API
        try {
          const response = await fetch('/api/auth/session');
          const data = await response.json();
          if (data.user) {
            setUserId(data.user.id);
            await fetchUserProfile(data.user.id);
          }
        } catch (e) {
          console.error('Failed to get session in Navbar', e);
        }
      }
    };
    getSession();
  }, []);

  const fetchUserProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, full_name')
        .eq('id', uid)
        .single();
      
      if (!error && data?.avatar_url && data.avatar_url.trim() !== '') {
        setUserAvatarUrl(`/api/media/avatars/${data.avatar_url}`);
        setShowFallback(false);
      } else {
        setShowFallback(true);
      }
    } catch (e) {
      console.error('Failed to fetch user profile', e);
      setShowFallback(true);
    }
  };

  const handleImageError = () => {
    setShowFallback(true);
  };
  
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 w-full px-4 h-16 flex items-center justify-between bg-white dark:bg-black">
        {/* Left: Settings */}
        <div className="flex items-center w-10">
          <Settings2 className="w-6 h-6 text-black dark:text-white" strokeWidth={1.5} />
        </div>

        {/* Center: Share */}
        <div className="flex items-center justify-center flex-1">
          <Share2 className="w-6 h-6 text-black dark:text-white" strokeWidth={1.5} />
        </div>
        
        {/* Right: Profile Photo or User Icon */}
        <Link
          href="/profile"
          className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
            {userAvatarUrl && !showFallback ? (
              <img
                src={userAvatarUrl}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={handleImageError}
              />
            ) : (
              <UserCircle className="w-5 h-5 text-zinc-600 dark:text-zinc-400" strokeWidth={1.5} />
            )}
          </div>
        </Link>
      </nav>
    );
}
