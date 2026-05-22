'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PostCard } from '@/components/PostCard';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { BottomNav } from '@/components/BottomNav';
import { Calendar, User, Menu, Globe, Lock, Eye, EyeOff, UserCircle, AtSign, Cake, Mars, Venus, Heart, Briefcase, QrCode, Download, ScanLine, Share2, Copy, X, Camera } from 'lucide-react';
import { MainMenu } from '@/components/MainMenu';
import { Loader } from '@/components/ui/loader';
import { ProfileSkeleton } from '@/components/ProfileSkeleton';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { MentionText } from '@/components/MentionText';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';

type Tab = 'posts' | 'stories' | 'saved' | 'about';

interface Profile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  cover_url: string;
  account_type?: string;
  identity_tag?: string | null;
  // Personal fields
  bio?: string;
  date_of_birth?: string;
  gender?: string;
  relationship_status?: string;
  // Brand fields
  description?: string;
  since?: string;
  org_type?: string;
  saved_visibility?: 'public' | 'private';
  created_at?: string;
}

export default function ProfilePage() {
  const isHeaderVisible = useScrollDirection();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // Share Profile Bottom Sheet
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Scan QR
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (menuOpen || shareSheetOpen) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, [menuOpen, shareSheetOpen]);

  // Generate QR code when sheet opens
  useEffect(() => {
    if (shareSheetOpen && profile?.username) {
      const profileUrl = `${window.location.origin}/${profile.username}`;
      QRCode.toDataURL(profileUrl, {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      }).then((url) => {
        setQrDataUrl(url);
      });
    }
  }, [shareSheetOpen, profile?.username]);

  // Cleanup scan on unmount
  useEffect(() => {
    return () => {
      stopScan();
    };
  }, []);

  const stopScan = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach(t => t.stop());
      scanStreamRef.current = null;
    }
    setScanning(false);
  };

  const handleScanQR = async () => {
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      scanStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Use BarcodeDetector if available
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const rawValue: string = barcodes[0].rawValue;
              stopScan();
              // Parse username from URL or direct username
              const match = rawValue.match(/\/(?:user\/)?([^/?#]+)$/);
              if (match) {
                router.push(`/${match[1]}`);
                setShareSheetOpen(false);
              } else {
                toast.error('No valid profile QR code found');
              }
            }
          } catch {}
        }, 300);
      } else {
        toast.error('QR scanning not supported on this browser');
        stopScan();
      }
    } catch {
      toast.error('Camera access denied');
      setScanning(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl || !profile?.username) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${profile.username}-qr.png`;
    link.click();
  };

  const handleShareTo = async () => {
    if (!profile?.username) return;
    const profileUrl = `${window.location.origin}/${profile.username}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile.full_name || profile.username,
          text: `Check out @${profile.username} on Sharable`,
          url: profileUrl,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(profileUrl);
      toast.success('Link copied to clipboard');
    }
  };

  const handleCopyLink = async () => {
    if (!profile?.username) return;
    const profileUrl = `${window.location.origin}/${profile.username}`;
    await navigator.clipboard.writeText(profileUrl);
    toast.success('Link copied!');
  };

  // Privacy Toggle States
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleDeletePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowPasswordModal(true);
    }, 800);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const toggleSavedPrivacy = async () => {
    if (!profile) return;

    setVerifyingPassword(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) throw new Error('User not found');

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: profile.username,
          password: password,
        }),
      });

      if (!response.ok) {
        toast.error('Incorrect password');
        setVerifyingPassword(false);
        return;
      }

      const newVisibility = profile.saved_visibility === 'public' ? 'private' : 'public';

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ saved_visibility: newVisibility })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, saved_visibility: newVisibility });
      toast.success(`Saved posts are now ${newVisibility}`);
      setShowPasswordModal(false);
      setPassword('');
    } catch (error) {
      toast.error('Failed to update privacy');
    } finally {
      setVerifyingPassword(false);
    }
  };

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (profileData) {
            setProfile(profileData);
          }

          const { data: postsData } = await supabase
            .from('posts')
            .select(`
              *,
              user:profiles(full_name, avatar_url, username, identity_tag),
              original_post:reposted_id(
                *,
                user:profiles(full_name, avatar_url, username, identity_tag)
              )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (postsData) {
            setPosts(postsData);
          }

          const { data: storiesData } = await supabase
            .from('stories')
            .select('id, content, bg_color, photo_url, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (storiesData) {
            setStories(storiesData);
          }

          const { data: savedData } = await supabase
            .from('saved_posts')
            .select(`
                post:posts(
                  *,
                  user:profiles(full_name, avatar_url, username, identity_tag),
                  original_post:reposted_id(
                    *,
                    user:profiles(full_name, avatar_url, username, identity_tag)
                  )
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (savedData) {
            setSavedPosts(savedData.map((s: any) => s.post).filter(Boolean));
          }

          const countsRes = await fetch(`/api/follow?user_id=${user.id}`);
          if (countsRes.ok) {
            const countsData = await countsRes.json();
            setFollowersCount(countsData.followers_count || 0);
            setFollowingCount(countsData.following_count || 0);
          }
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);


  const coverSrc = profile?.cover_url && profile.cover_url.trim() !== ''
    ? `/api/media/covers/${profile.cover_url}`
    : null;

  const avatarSrc = profile?.avatar_url && profile.avatar_url.trim() !== ''
    ? `/api/media/avatars/${profile.avatar_url}`
    : null;

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <>
        <ProfileSkeleton />
        <BottomNav />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">

      <MainMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        avatarSrc={avatarSrc}
      />

      <main className="w-full pb-20">
        <div className="relative">
          <div className="w-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden" style={{height: '120px'}}>
            {coverSrc ? (
              <img
                src={coverSrc}
                alt="Cover"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-200 dark:from-zinc-800 to-zinc-300 dark:to-zinc-900" />
            )}
          </div>

          <div className="absolute -bottom-10 left-4 w-20 h-20">
            <div className="w-full h-full rounded-full border-4 border-white dark:border-black overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={profile?.full_name || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircle size={52} strokeWidth={1} className="text-zinc-400 dark:text-zinc-600" />
              )}
            </div>
          </div>

          <button
            onClick={() => setMenuOpen(true)}
            className="absolute top-4 right-4 p-2.5 bg-white/90 dark:bg-black/90 backdrop-blur-sm text-foreground rounded-full border border-black/10 dark:border-white/10 hover:bg-white dark:hover:bg-black transition-colors"
          >
            <Menu size={24} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-12 px-4">
          <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
            <h1 className="text-2xl font-bold">{profile?.full_name || profile?.username}</h1>
            <VerifiedBadge username={profile?.username} />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">@{profile?.username}</p>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="text-center">
              <span className="font-bold">{posts.length}</span>
              <span className="text-zinc-500 text-sm ml-1">Posts</span>
            </div>
            <div className="text-center">
              <span className="font-bold">{followersCount}</span>
              <span className="text-zinc-500 text-sm ml-1">Followers</span>
            </div>
            <div className="text-center">
              <span className="font-bold">{followingCount}</span>
              <span className="text-zinc-500 text-sm ml-1">Following</span>
            </div>
          </div>

          {(() => {
            const blurb = profile?.account_type === 'brand' ? profile?.description : profile?.bio;
            return blurb ? (
              <p className="mt-4 text-zinc-700 dark:text-zinc-300 text-[15px] leading-relaxed">
                <MentionText text={blurb} />
              </p>
            ) : null;
          })()}

          <div className="flex gap-3 mt-6 mb-6">
            <Link
              href="/profile/edit"
              className="flex-1 flex items-center justify-center px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 text-foreground font-bold text-sm rounded-full border border-black/10 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              Edit Profile
            </Link>
            <button
              onClick={() => setShareSheetOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black font-bold text-sm rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              <QrCode size={16} strokeWidth={2} />
              Share Profile
            </button>
          </div>

          <div className="flex mt-6">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 py-3 text-sm font-bold transition-colors relative ${
                activeTab === 'posts' ? 'text-foreground' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Posts
              {activeTab === 'posts' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('stories')}
              className={`flex-1 py-3 text-sm font-bold transition-colors relative ${
                activeTab === 'stories' ? 'text-foreground' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Stories
              {activeTab === 'stories' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              onMouseDown={handleLongPressStart}
              onMouseUp={handleLongPressEnd}
              onMouseLeave={handleLongPressEnd}
              onTouchStart={handleLongPressStart}
              onTouchEnd={handleLongPressEnd}
              className={`flex-1 py-3 text-sm font-bold transition-colors relative flex items-center justify-center gap-1.5 ${
                activeTab === 'saved' ? 'text-foreground' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Saved
              {profile?.saved_visibility === 'public' ? (
                <Globe size={14} strokeWidth={1.5} className="opacity-70" />
              ) : (
                <Lock size={14} strokeWidth={1.5} className="opacity-70" />
              )}
              {activeTab === 'saved' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`flex-1 py-3 text-sm font-bold transition-colors relative ${
                activeTab === 'about' ? 'text-foreground' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              About
              {activeTab === 'about' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white"
                />
              )}
            </button>
          </div>
        </div>

        <div className="mt-4">
          {activeTab === 'posts' ? (
            posts.length > 0 ? (
              <div className="flex flex-col">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    {...post}
                    onDelete={handleDeletePost}
                    avatarSize={40}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">📭</span>
                </div>
                <h3 className="text-xl font-bold mb-2">No posts yet</h3>
                <p className="text-zinc-500 max-w-[240px]">
                  Share your first post with the world!
                </p>
              </div>
            )
          ) : activeTab === 'stories' ? (
            stories.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 px-4">
                {stories.map((story) => (
                  <Link
                    key={story.id}
                    href={`/create/story/view?id=${story.id}`}
                    className="relative rounded-2xl overflow-hidden group"
                    style={{ aspectRatio: '9/16' }}
                  >
                    {story.photo_url ? (
                      <img
                        src={story.photo_url.startsWith('__posts__') ? `/api/media/posts/${story.photo_url.replace('__posts__', '')}` : story.photo_url.startsWith('/api/') ? story.photo_url : `/api/media/stories/${story.photo_url}`}
                        alt="Story"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 w-full h-full" style={{ backgroundColor: story.bg_color || '#18181b' }} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    {story.content && (
                      <div className="absolute inset-0 flex items-center justify-center px-3">
                        <p className="text-white text-sm font-medium text-center leading-snug line-clamp-4 drop-shadow-md">
                          {story.content}
                        </p>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full border-2 border-white/80 overflow-hidden bg-zinc-700 flex-shrink-0">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt={profile?.full_name || 'User'} className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle size={40} strokeWidth={1} className="text-zinc-400 w-full h-full" />
                        )}
                      </div>
                      <p className="text-white text-[13px] font-semibold leading-tight truncate">
                        {profile?.full_name || profile?.username || 'User'}
                      </p>
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">📖</span>
                </div>
                <h3 className="text-xl font-bold mb-2">No stories yet</h3>
                <p className="text-zinc-500 max-w-[240px]">
                  Share your first story!
                </p>
              </div>
            )
          ) : activeTab === 'saved' ? (
            savedPosts.length > 0 ? (
              <div className="flex flex-col">
                {savedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    {...post}
                    avatarSize={40}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">🔖</span>
                </div>
                <h3 className="text-xl font-bold mb-2">No saved posts</h3>
                <p className="text-zinc-500 max-w-[240px]">
                  Posts you save will appear here.
                </p>
              </div>
            )
          ) : (
            <div className="px-4 py-4 space-y-4">
              {/* Section 1: Bio / Description */}
              <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5">
                <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {profile?.account_type === 'brand' ? 'Description' : 'Bio'}
                  </span>
                </div>
                <p className="text-foreground leading-relaxed text-[15px]">
                  {profile?.account_type === 'brand'
                    ? (profile?.description ? <MentionText text={profile.description} /> : 'No description yet.')
                    : (profile?.bio ? <MentionText text={profile.bio} /> : 'No bio yet.')
                  }
                </p>
              </div>

              {/* Section 2: Account Type & Role */}
              <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5 space-y-4">
                {/* Account Type */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                    {profile?.account_type === 'brand' ? (
                      <Briefcase size={22} strokeWidth={1.5} />
                    ) : (
                      <User size={22} strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Account Type</p>
                    <p className="font-semibold text-foreground">
                      {profile?.account_type === 'brand' ? 'Brand Account' : 'Personal Account'}
                    </p>
                  </div>
                </div>

                {/* Account Role */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <UserCircle size={22} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Account Role</p>
                    <p className="font-semibold text-foreground">
                      {profile?.identity_tag || 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 3: Other Details */}
              <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5 space-y-4">
                {/* Full Name */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <UserCircle size={22} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Full Name</p>
                    <p className="font-semibold text-foreground">{profile?.full_name || 'Not set'}</p>
                  </div>
                </div>

                {/* Username */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <AtSign size={22} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Sharable ID</p>
                    <p className="font-semibold text-foreground">@{profile?.username || 'Not set'}</p>
                  </div>
                </div>

                {/* PERSONAL: Date of Birth */}
                {profile?.account_type !== 'brand' && (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                      <Cake size={22} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Date of Birth</p>
                      <p className="font-semibold text-foreground">{formatDate(profile?.date_of_birth || '')}</p>
                    </div>
                  </div>
                )}

                {/* PERSONAL: Gender */}
                {profile?.account_type !== 'brand' && (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                      {profile?.gender?.toLowerCase() === 'male' ? (
                        <Mars size={22} strokeWidth={1.5} className="text-blue-500" />
                      ) : profile?.gender?.toLowerCase() === 'female' ? (
                        <Venus size={22} strokeWidth={1.5} className="text-pink-500" />
                      ) : (
                        <User size={22} strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Gender</p>
                      <p className="font-semibold text-foreground capitalize">{profile?.gender || 'Not set'}</p>
                    </div>
                  </div>
                )}

                {/* PERSONAL: Relationship Status */}
                {profile?.account_type !== 'brand' && (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                      <Heart size={22} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Relationship Status</p>
                      <p className="font-semibold text-foreground">{profile?.relationship_status || 'Not set'}</p>
                    </div>
                  </div>
                )}

                {/* BRAND: Since */}
                {profile?.account_type === 'brand' && (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                      <Calendar size={22} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Since</p>
                      <p className="font-semibold text-foreground">{profile?.since ? formatDate(profile.since) : 'Not set'}</p>
                    </div>
                  </div>
                )}

                {/* Active From */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <Calendar size={22} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Active From</p>
                    <p className="font-semibold text-foreground">{formatDate(profile?.created_at || '')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ��─ Share Profile Bottom Sheet ── */}
      <AnimatePresence>
        {shareSheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShareSheetOpen(false); stopScan(); }}
              className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[100] bg-white dark:bg-zinc-950 rounded-t-3xl px-5 pt-4 pb-8 max-w-xl mx-auto shadow-2xl"
            >
              {/* Handle */}
              <div className="bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto" style={{ marginTop: '16px', marginBottom: '16px', width: '48px', height: '8px' }} />

              {/* Close button */}
              <button
                onClick={() => { setShareSheetOpen(false); stopScan(); }}
                className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <h2 className="text-lg font-bold text-center mb-6">Share Profile</h2>

              {scanning ? (
                /* ── Scanner View ── */
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-full max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-black aspect-square">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                    {/* Scan overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-2 border-white/80 rounded-2xl relative">
                        <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg -translate-x-0.5 -translate-y-0.5" />
                        <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg translate-x-0.5 -translate-y-0.5" />
                        <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg -translate-x-0.5 translate-y-0.5" />
                        <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg translate-x-0.5 translate-y-0.5" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-500 text-center">Point the camera at a profile QR code</p>
                  <button
                    onClick={stopScan}
                    className="px-6 py-2.5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-foreground font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel Scan
                  </button>
                </div>
              ) : (
                /* ── QR & Actions View ── */
                <div className="flex flex-col items-center gap-5">
                  {/* QR Code */}
                  <div className="p-4 bg-white rounded-2xl shadow-sm border border-black/5">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Profile QR Code"
                        className="w-52 h-52 object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <div className="w-52 h-52 flex items-center justify-center">
                        <Loader centered={false} />
                      </div>
                    )}
                  </div>

                  {/* Username */}
                  <p className="text-base font-bold text-foreground">@{profile?.username}</p>

                  {/* Top action buttons */}
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={handleDownloadQR}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-foreground font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors border border-black/5 dark:border-white/5"
                    >
                      <Download size={16} strokeWidth={2} />
                      Download QR
                    </button>
                    <button
                      onClick={handleScanQR}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-foreground font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors border border-black/5 dark:border-white/5"
                    >
                      <ScanLine size={16} strokeWidth={2} />
                      Scan QR
                    </button>
                  </div>

                  {/* Bottom action buttons */}
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={handleShareTo}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-bold text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                    >
                      <Share2 size={16} strokeWidth={2} />
                      Share to
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-bold text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                    >
                      <Copy size={16} strokeWidth={2} />
                      Copy link
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Password Modal ── */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPasswordModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-black/10 dark:border-white/10"
            >
              <h2 className="text-xl font-bold mb-2">Change Privacy</h2>
              <p className="text-zinc-500 text-sm mb-6">
                Enter your password to make saved posts {profile?.saved_visibility === 'public' ? 'Private' : 'Public'}.
              </p>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                    autoFocus
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black dark:hover:text-white"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 px-4 py-3 rounded-2xl font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={toggleSavedPrivacy}
                    disabled={verifyingPassword || !password}
                    className="flex-1 px-4 py-3 rounded-2xl font-bold bg-black dark:bg-white text-white dark:text-black disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {verifyingPassword ? <Loader centered={false} className="text-current" /> : 'Confirm'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
