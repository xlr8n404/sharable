'use client';
import { useNavBack } from '@/components/NavigationHistoryProvider';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PostCard } from '@/components/PostCard';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { BottomNav } from '@/components/BottomNav';
import { Calendar, User, MessageCircle, ArrowLeft, UserCircle, AtSign, Cake, Mars, Venus, Heart, CircleUser, Briefcase } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { ProfileSkeleton } from '@/components/ProfileSkeleton';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { MentionText } from '@/components/MentionText';

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

export default function UserProfilePage() {
  const isHeaderVisible = useScrollDirection();
  const params = useParams();
  const router = useRouter();
  const { goBack } = useNavBack();
  const username = params.username as string;
  const sharableId = username.toLowerCase(); // Username param is the username

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [userStories, setUserStories] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, cover_url, account_type, identity_tag, bio, description, date_of_birth, gender, since, org_type, saved_visibility, relationship_status, created_at')
      .eq('username', sharableId)
        .single();

      if (profileData) {
        setProfile(profileData);

        if (user?.id === profileData.id) {
          router.replace('/profile');
          return;
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
          .eq('user_id', profileData.id)
          .order('created_at', { ascending: false });

        if (postsData) {
          setPosts(postsData);
        }

        // Fetch user stories
        const { data: storiesData } = await supabase
          .from('stories')
          .select('id, content, bg_color, photo_url, created_at')
          .eq('user_id', profileData.id)
          .order('created_at', { ascending: false });

        if (storiesData) {
          setUserStories(storiesData);
        }

        // Fetch saved posts if public
        if (profileData.saved_visibility === 'public') {
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
              .eq('user_id', profileData.id)
              .order('created_at', { ascending: false });

          if (savedData) {
            setSavedPosts(savedData.map((s: any) => s.post).filter(Boolean));
          }
        }

        const countsRes = await fetch(`/api/follow?user_id=${profileData.id}`);
        const countsData = await countsRes.json();
        setFollowersCount(countsData.followers_count || 0);
        setFollowingCount(countsData.following_count || 0);

        if (user) {
          const checkRes = await fetch(`/api/follow/check?follower_id=${user.id}&following_id=${profileData.id}`);
          const checkData = await checkRes.json();
          setIsFollowing(checkData.isFollowing || false);
        }
      }

      setLoading(false);
    }

    fetchProfile();
  }, [username, router]);

  const handleMessage = async () => {
    if (!currentUserId || !profile) {
      toast.error('Please login to message');
      return;
    }

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user1_id: currentUserId,
          user2_id: profile.id,
        }),
      });

      if (res.ok) {
        router.push('/messages');
      } else {
        toast.error('Failed to start conversation');
      }
    } catch (error) {
      toast.error('Something went wrong');
    }
  };

  const handleFollow = async () => {
    if (!currentUserId || !profile) {
      toast.error('Please login to follow');
      return;
    }

    setFollowLoading(true);
    try {
      if (isFollowing) {
        const res = await fetch('/api/follow', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            follower_id: currentUserId,
            following_id: profile.id,
          }),
        });

        if (res.ok) {
          setIsFollowing(false);
          setFollowersCount((prev) => Math.max(0, prev - 1));
          toast.success(`Unfollowed @${profile.username}`);
        }
      } else {
        const res = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            follower_id: currentUserId,
            following_id: profile.id,
          }),
        });

        if (res.ok) {
          setIsFollowing(true);
          setFollowersCount((prev) => prev + 1);
          toast.success(`Following @${profile.username}`);
        }
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setFollowLoading(false);
    }
  };

  const coverSrc = profile?.cover_url && profile.cover_url.trim() !== ''
    ? `/api/media/covers/${profile.cover_url}`
    : null;

  const avatarSrc = profile?.avatar_url && profile.avatar_url.trim() !== ''
    ? `/api/media/avatars/${profile.avatar_url}`
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
    return (
      <>
        <ProfileSkeleton />
        <BottomNav />
      </>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-2">
            <User className="w-8 h-8 text-zinc-500" />
          </div>
          <h2 className="text-xl font-bold">User not found</h2>
          <p className="text-zinc-500">@{username} doesn't exist</p>
          <Link href="/home" className="mt-4 px-6 py-2 bg-black dark:bg-white text-white dark:text-black font-bold rounded-full">
            Go Home
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-background text-foreground selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">
        <header className={`fixed top-0 left-0 right-0 z-50 px-4 h-16 flex items-center bg-transparent transition-transform duration-300 hidden ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
          <button onClick={() => goBack()} className="p-2 -ml-2 text-foreground hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="ml-2 flex items-center gap-1.5 min-w-0">
            <span className="font-[family-name:var(--font-syne)] font-bold text-lg truncate">Sharable ID</span>
            <VerifiedBadge username={username} className="w-3.5 h-3.5 text-white shrink-0" />
          </div>
        </header>
        <main className="max-w-7xl mx-auto pb-20">
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
          <div className="w-full h-full rounded-full border-4 border-white dark:border-black overflow-hidden bg-zinc-100 dark:bg-zinc-900">
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

      </div>

            <div className="mt-[4.5rem] px-4">
              <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                <h1 className="text-2xl font-bold">{profile?.full_name || profile?.username}</h1>
                <VerifiedBadge username={profile?.username} />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">@{profile?.username}</p>
              </div>
        <div className="flex items-center gap-4 mt-3">
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
            <button
              onClick={handleMessage}
              className="flex-1 flex items-center justify-center px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 text-foreground font-bold text-sm rounded-full border border-black/10 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              Message
            </button>
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-bold text-sm rounded-full transition-colors disabled:opacity-50 ${
                isFollowing
                  ? 'bg-zinc-100 dark:bg-zinc-900 text-foreground border border-black/10 dark:border-white/10 hover:bg-red-50 dark:hover:bg-red-900/50 hover:border-red-500/50 hover:text-red-500'
                  : 'bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200'
              }`}
            >
              {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
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
                  layoutId="activeTabUser"
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
                  layoutId="activeTabUser"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white"
                />
              )}
            </button>

            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 py-3 text-sm font-bold transition-colors relative flex items-center justify-center gap-1.5 ${
                activeTab === 'saved' ? 'text-foreground' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Saved
              {activeTab === 'saved' && (
                <motion.div
                  layoutId="activeTabUser"
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
                  layoutId="activeTabUser"
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
                <PostCard key={post.id} {...post} avatarSize={40} />
              ))}
            </div>
          ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">📭</span>
              </div>
              <h3 className="text-xl font-bold mb-2">No posts yet</h3>
              <p className="text-zinc-500 max-w-[240px]">
                This user hasn't posted yet.
              </p>
            </div>
          )
        ) : activeTab === 'stories' ? (
          userStories.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 px-4">
              {userStories.map((story: any) => (
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
                      <img
                        src={avatarSrc}
                        alt={profile?.full_name || 'User'}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=default`; }}
                      />
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
                This user hasn't posted any stories yet.
              </p>
            </div>
          )
        ) : activeTab === 'saved' ? (
          savedPosts.length > 0 ? (
            <div className="flex flex-col">
              {savedPosts.map((post) => (
                <PostCard key={post.id} {...post} avatarSize={40} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">🔖</span>
              </div>
                <h3 className="text-xl font-bold mb-2">No saved posts</h3>
                <p className="text-zinc-500 max-w-[240px]">
                  This user hasn't saved any posts yet.
                </p>
            </div>
          )
          ) : (
            <div className="px-4 py-4 space-y-4">
              {/* Bio / Description Box */}
              <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-foreground mb-2">
                    {profile?.account_type === 'brand' ? 'Description' : 'Bio'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      {profile?.account_type === 'brand' ? 'Brand Account' : 'Personal Account'}
                    </span>
                    {profile?.identity_tag && (
                      <span className="px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {profile.identity_tag}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-foreground leading-relaxed text-[15px]">
                  {profile?.account_type === 'brand'
                    ? (profile?.description ? <MentionText text={profile.description} /> : 'No description yet.')
                    : (profile?.bio ? <MentionText text={profile.bio} /> : 'No bio yet.')
                  }
                </p>
              </div>

              {/* Details Box */}
              <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5 space-y-6">
                {/* Full Name — always shown */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <UserCircle size={22} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">Full Name</p>
                    <p className="font-semibold text-foreground">{profile?.full_name || 'Not set'}</p>
                  </div>
                </div>

                {/* Username — always shown */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <AtSign size={22} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">username</p>
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
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">since</p>
                      <p className="font-semibold text-foreground">{profile?.since ? formatDate(profile.since) : 'Not set'}</p>
                    </div>
                  </div>
                )}

                {/* Active From — always shown */}
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

    <BottomNav />
  </div>
);
}
