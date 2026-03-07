'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { PostCard } from '@/components/PostCard';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { BottomNav } from '@/components/BottomNav';
import { Calendar, User, UserRoundPen, Menu, X, Settings, LogOut, Share2, Globe, Lock, Eye, EyeOff, UserCircle, AtSign, Cake, Mars, Venus, Heart } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { MentionText } from '@/components/MentionText';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type Tab = 'posts' | 'saved' | 'about';

interface Profile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  cover_url: string;
  bio: string;
  date_of_birth: string;
    gender: string;
    saved_visibility?: 'public' | 'private';
    relationship_status?: string;
    created_at?: string;
  }

export default function ProfilePage() {
  const isHeaderVisible = useScrollDirection();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  useEffect(() => {
    if (menuOpen) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, [menuOpen]);

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
    }, 800); // 800ms for long press
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

      // Verify password by attempting to sign in
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
                  user:profiles(full_name, avatar_url, username),
                  original_post:reposted_id(
                    *,
                    user:profiles(full_name, avatar_url, username)
                  )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (postsData) {
              setPosts(postsData);
            }

            // Fetch saved posts
            const { data: savedData } = await supabase
              .from('saved_posts')
              .select(`
                  post:posts(
                    *,
                    user:profiles(full_name, avatar_url, username),
                    original_post:reposted_id(
                      *,
                      user:profiles(full_name, avatar_url, username)
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
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${profile.cover_url}`
    : null;

  const avatarSrc = profile?.avatar_url && profile.avatar_url.trim() !== ''
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_url}`
    : profile?.full_name
      ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.full_name}`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=default`;

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return <Loader fullScreen />;
  }

    return (
      <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">
        <header className={`fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-black/[0.08] dark:border-white/[0.08] transition-transform duration-300 ${
          isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
        }`}>
          <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">

            <span className="font-bold text-[22px] tracking-tight font-[family-name:var(--font-syne)]">
              Profile
            </span>
          <button 
            onClick={() => setMenuOpen(true)}
            className="p-2 -mr-2 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <Menu size={24} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[60]">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
            <div className="absolute top-0 right-0 h-full w-72 bg-zinc-100 dark:bg-zinc-900 shadow-2xl animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2 group">
                <div className="flex items-center justify-center w-8 h-8">
                  <Share2 size={32} strokeWidth={2.5} className="text-black dark:text-white" />
                </div>
                <span className="font-bold text-[22px] tracking-tight font-[family-name:var(--font-syne)] text-black dark:text-white">
                  Sharable
                </span>
              </div>
              <button 
                onClick={() => setMenuOpen(false)}
                className="p-2 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={24} strokeWidth={1.5} />
              </button>
            </div>
            <nav className="p-2">
              <button 
                onClick={() => {
                  setMenuOpen(false);
                  router.push('/settings');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <Settings size={24} strokeWidth={1.5} />
                <span className="font-medium">Settings</span>
              </button>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-500 dark:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <LogOut size={24} strokeWidth={1.5} />
                <span className="font-medium">Log out</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      <main className="max-w-xl mx-auto pt-16 pb-20">
        <div className="relative">
          <div className="w-full h-36 md:h-48 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
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

            <div className="absolute -bottom-12 left-4">
              <div className="w-24 h-24 rounded-full border-4 border-white dark:border-black overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                <img
                  src={avatarSrc}
                  alt={profile?.full_name || 'User'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=default`;
                  }}
                />
              </div>
            </div>

            <div className="absolute right-4 -bottom-5 flex items-center gap-2">
                  <Link
                    href="/profile/edit"
                    className="p-2.5 bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white rounded-full border border-black/10 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <UserRoundPen size={24} strokeWidth={1.5} />
                  </Link>
                    <Link
                      href="/post/create"
                      className="flex items-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black font-bold text-sm rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                    >
                      Share
                    </Link>
              </div>
            </div>

            <div className="mt-16 px-4">
                <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                  <h1 className="text-xl font-bold">{profile?.full_name || profile?.username}</h1>
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

            {profile?.bio && (
              <p className="mt-4 text-zinc-700 dark:text-zinc-300 text-[15px] leading-relaxed">
                <MentionText text={profile.bio} />
              </p>
            )}

          <div className="flex mt-6">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 py-3 text-sm font-bold transition-colors relative ${
                activeTab === 'posts' ? 'text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
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
              onClick={() => setActiveTab('saved')}
              onMouseDown={handleLongPressStart}
              onMouseUp={handleLongPressEnd}
              onMouseLeave={handleLongPressEnd}
              onTouchStart={handleLongPressStart}
              onTouchEnd={handleLongPressEnd}
              className={`flex-1 py-3 text-sm font-bold transition-colors relative flex items-center justify-center gap-1.5 ${
                activeTab === 'saved' ? 'text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
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
                activeTab === 'about' ? 'text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
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
                  {/* Bio Box */}
                  <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 mb-3">
                      <span className="text-xs font-bold uppercase tracking-widest">Bio</span>
                    </div>
                    <p className="text-black dark:text-white leading-relaxed text-[15px]">
                      {profile?.bio ? <MentionText text={profile.bio} /> : 'No bio yet.'}
                    </p>
                  </div>

                  {/* Details Box */}
                  <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                        <UserCircle size={22} strokeWidth={1.5} />
                      </div>
                        <div className="flex-1">
                          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Full Name</p>
                          <p className="font-semibold text-black dark:text-white">{profile?.full_name || 'Not set'}</p>
                        </div>

                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                        <AtSign size={22} strokeWidth={1.5} />
                      </div>
                        <div className="flex-1">
                          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Username</p>
                          <p className="font-semibold text-black dark:text-white">@{profile?.username || 'Not set'}</p>
                        </div>

                    </div>

                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                          <Cake size={22} strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Date of Birth</p>
                          <p className="font-semibold text-black dark:text-white">{formatDate(profile?.date_of_birth || '')}</p>
                        </div>
                      </div>

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
                          <p className="font-semibold text-black dark:text-white capitalize">{profile?.gender || 'Not set'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                          <Heart size={22} strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Relationship Status</p>
                          <p className="font-semibold text-black dark:text-white">{profile?.relationship_status || 'Not set'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                          <Calendar size={22} strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Active From</p>
                          <p className="font-semibold text-black dark:text-white">{formatDate(profile?.created_at || '')}</p>
                        </div>
                      </div>
                    </div>
                </div>
              )}

        </div>
      </main>

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
