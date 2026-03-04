'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Camera } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

interface Profile {
    id: string;
    full_name: string;
    username: string;
    bio: string;
    avatar_url: string;
    cover_url: string;
    date_of_birth: string;
    gender: string;
    relationship_status: string;
  }

export default function EditProfilePage() {
  const isHeaderVisible = useScrollDirection();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
    const [gender, setGender] = useState('');
    const [relationshipStatus, setRelationshipStatus] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [newAvatar, setNewAvatar] = useState<File | null>(null);
  const [newCover, setNewCover] = useState<File | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFullName(profileData.full_name || '');
        setUsername(profileData.username || '');
        setBio(profileData.bio || '');
          setDateOfBirth(profileData.date_of_birth || '');
            setGender(profileData.gender || '');
            setRelationshipStatus(profileData.relationship_status || '');
      }
      
      setLoading(false);
    }

    fetchProfile();
  }, [router]);

  const coverSrc = coverPreview || (profile?.cover_url && profile.cover_url.trim() !== ''
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${profile.cover_url}`
    : null);

  const avatarSrc = avatarPreview || (profile?.avatar_url && profile.avatar_url.trim() !== ''
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_url}`
    : profile?.full_name
      ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.full_name}`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=default`);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const loadingToast = toast.loading('Compressing image...');
      try {
        const options = {
          maxSizeMB: 0.2, // Small target for avatar
          maxWidthOrHeight: 500,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);
        setNewAvatar(new File([compressedFile], file.name, { type: file.type }));
        setAvatarPreview(URL.createObjectURL(compressedFile));
        toast.success('Avatar ready', { id: loadingToast });
      } catch (err) {
        toast.error('Failed to process avatar', { id: loadingToast });
      }
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const loadingToast = toast.loading('Compressing image...');
      try {
        const options = {
          maxSizeMB: 0.5, // Cover can be slightly larger
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);
        setNewCover(new File([compressedFile], file.name, { type: file.type }));
        setCoverPreview(URL.createObjectURL(compressedFile));
        toast.success('Cover ready', { id: loadingToast });
      } catch (err) {
        toast.error('Failed to process cover', { id: loadingToast });
      }
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);

    try {
      let avatarUrl = profile.avatar_url;
      let coverUrl = profile.cover_url;

      if (newAvatar) {
        const fd = new FormData();
        fd.append('file', newAvatar);
        fd.append('bucket', 'avatars');
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Avatar upload failed');
        const { path } = await res.json();
        avatarUrl = path;
      }

      if (newCover) {
        const fd = new FormData();
        fd.append('file', newCover);
        fd.append('bucket', 'covers');
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Cover upload failed');
        const { path } = await res.json();
        coverUrl = path;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
            bio: bio.trim(),
            date_of_birth: dateOfBirth || null,
            gender: gender,
            relationship_status: relationshipStatus || null,
            avatar_url: avatarUrl,
            cover_url: coverUrl,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Profile updated successfully!');
      router.push('/profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
      <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">
        <header className={`fixed top-0 left-0 right-0 z-50 px-4 h-16 flex items-center justify-between bg-transparent transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
          <div className="flex items-center">
            <Link href="/profile" className="p-2 -ml-2 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors" onClick={(e) => { e.preventDefault(); router.back(); }}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="ml-2 font-bold text-lg">Edit Profile</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
            className={`px-5 py-2 font-bold text-sm rounded-full transition-colors ${
              saving
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                : 'bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200'
          }`}
        >
            {saving ? <Loader centered={false} className="text-current" /> : 'Save'}

        </button>
      </header>

      <main className="max-w-xl mx-auto pt-16 pb-20">
        <div className="relative">
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverChange}
            className="hidden"
          />
            <div 
              onClick={() => coverInputRef.current?.click()}
                className="w-full h-36 md:h-48 bg-zinc-100 dark:bg-zinc-900 overflow-hidden cursor-pointer group relative"
            >
              {coverSrc ? (
                <img
                  src={coverSrc}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-200 dark:from-zinc-800 to-zinc-300 dark:to-zinc-900" />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="bg-black/60 p-3 rounded-full">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
            <div 
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-12 left-4 cursor-pointer group"
            >
                <div className="w-24 h-24 rounded-full border-4 border-white dark:border-black overflow-hidden bg-zinc-100 dark:bg-zinc-900 relative">
                <img
                  src={avatarSrc}
                  alt={profile?.full_name || 'User'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                  <div className="bg-black/60 p-2 rounded-full">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            </div>
        </div>

        <div className="mt-16 px-4 space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  maxLength={15}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors"
                  placeholder="Your full name"
                />
            </div>

              <div>
                  <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Username</label>
                  <input
                    type="text"
                    value={username}
                    disabled
                    className="w-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 px-4 py-3 rounded-xl border border-black/5 dark:border-white/5 outline-none cursor-not-allowed"
                    placeholder="username"
                  />
                  <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">Username cannot be changed</p>
                </div>

            <div>
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex justify-between">
                <span>Bio</span>
                  <span className={`${bio.length >= 115 ? 'text-red-500' : 'text-zinc-400'} text-xs`}>{bio.length}/115</span>
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={115}
                rows={3}
                className="w-full bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors resize-none"
                placeholder="Tell us about yourself"
              />
            </div>

              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors"
                >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Relationship Status</label>
                <select
                  value={relationshipStatus}
                  onChange={(e) => setRelationshipStatus(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors"
                >
                  <option value="">Select status</option>
                  <option value="Single">Single</option>
                  <option value="In a relationship">In a relationship</option>
                  <option value="Engaged">Engaged</option>
                  <option value="Married">Married</option>
                  <option value="In an open relationship">In an open relationship</option>
                  <option value="It's complicated">It's complicated</option>
                  <option value="Separated">Separated</option>
                  <option value="Divorced">Divorced</option>
                </select>
              </div>
        </div>
      </main>
    </div>
  );
}
