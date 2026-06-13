'use client';
import { useNavBack } from '@/components/NavigationHistoryProvider';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Camera, CircleUser } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { ProfileSkeleton } from '@/components/ProfileSkeleton';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { IdentityTagSelector } from '@/components/identity-tag-selector';
import { AvatarCoverSelector } from '@/components/avatar-cover-selector';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

interface Profile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  cover_url: string;
  account_type?: string;
  // Personal fields
  bio?: string;
  date_of_birth?: string;
  gender?: string;
  relationship_status?: string;
  // Brand fields
  description?: string;
  since?: string;
  org_type?: string;
  identity_tag: string | null;
}

export default function EditProfilePage() {
  const router = useRouter();
  const { goBack } = useNavBack();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  // Personal fields
  const [bio, setBio] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState('');
  // Brand fields
  const [description, setDescription] = useState('');
  const [since, setSince] = useState('');
  const [orgType, setOrgType] = useState('');
  const [identityTag, setIdentityTag] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [newAvatar, setNewAvatar] = useState<File | null>(null);
  const [newCover, setNewCover] = useState<File | null>(null);
  const [deleteAvatar, setDeleteAvatar] = useState(false);
  const [deleteCover, setDeleteCover] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState<'avatar' | 'cover' | null>(null);

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
        // Personal
        setBio(profileData.bio || '');
        setDateOfBirth(profileData.date_of_birth || '');
        setGender(profileData.gender || '');
        setRelationshipStatus(profileData.relationship_status || '');
        // Brand
        setDescription(profileData.description || '');
        setSince(profileData.since || '');
        setOrgType(profileData.org_type || '');
        setIdentityTag(profileData.identity_tag || null);
      }
      
      setLoading(false);
    }

    fetchProfile();
  }, [router]);

  const coverSrc = coverPreview || (profile?.cover_url && profile.cover_url.trim() !== ''
    ? `/api/media/covers/${profile.cover_url}`
    : null);

  const avatarSrc = avatarPreview || (profile?.avatar_url && profile.avatar_url.trim() !== ''
    ? `/api/media/avatars/${profile.avatar_url}`
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

  const handleDeleteAvatar = () => {
    setNewAvatar(null);
    setAvatarPreview(null);
    setDeleteAvatar(true);
    toast.success('Profile picture will be deleted');
  };

  const handleDeleteCover = () => {
    setNewCover(null);
    setCoverPreview(null);
    setDeleteCover(true);
    toast.success('Cover photo will be deleted');
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);

    try {
      let avatarUrl = profile.avatar_url;
      let coverUrl = profile.cover_url;

      // Handle avatar deletion or upload
      if (deleteAvatar) {
        avatarUrl = '';
      } else if (newAvatar) {
        const fd = new FormData();
        fd.append('file', newAvatar);
        fd.append('bucket', 'avatars');
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Avatar upload failed');
        const { path } = await res.json();
        avatarUrl = path;
      }

      // Handle cover deletion or upload
      if (deleteCover) {
        coverUrl = '';
      } else if (newCover) {
        const fd = new FormData();
        fd.append('file', newCover);
        fd.append('bucket', 'covers');
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Cover upload failed');
        const { path } = await res.json();
        coverUrl = path;
      }

      const isBrand = profile.account_type === 'brand';
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          identity_tag: identityTag,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
          // Personal fields
          ...(isBrand ? {} : {
            bio: bio.trim(),
            date_of_birth: dateOfBirth || null,
            gender: gender,
            relationship_status: relationshipStatus || null,
          }),
          // Brand fields
          ...(isBrand ? {
            description: description.trim(),
            since: since || null,
            org_type: orgType || null,
          } : {}),
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
    return <EditProfileSkeleton />;
  }

  return (
      <div className="min-h-screen bg-background text-foreground selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">
        {/* Cover Photo Section with Overlay Header */}
        <div className="relative">
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverChange}
            className="hidden"
          />
          
          {/* Cover Photo - width: auto, height: 120px */}
          <div 
            onClick={() => setSelectorOpen('cover')}
            className="w-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden cursor-pointer group relative"
            style={{height: '120px'}}
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

          {/* Header Overlay on Cover Photo */}
          <div className="absolute top-0 left-0 right-0 px-4 flex items-center justify-between z-10 border-b border-black/10 dark:border-white/10" style={{height: '64px'}}>
            {/* Back Button */}
            <Link 
              href="/profile" 
              onClick={(e) => { e.preventDefault(); goBack(); }}
              className="p-2 -ml-2 text-white hover:bg-white/20 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-5 py-2 font-bold text-sm rounded-full transition-colors ${
                saving
                  ? 'bg-zinc-100/50 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                  : 'bg-black/60 dark:bg-white/60 text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80'
              }`}
            >
              {saving ? <Loader centered={false} className="text-current" /> : 'Save'}
            </button>
          </div>

          {/* Avatar - 80px, halfway down cover photo */}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <div 
            onClick={() => setSelectorOpen('avatar')}
            className="absolute left-4 cursor-pointer group"
            style={{top: '120px', transform: 'translateY(-50%)'}}
          >
            <div className="w-20 h-20 rounded-full border-4 border-white dark:border-black overflow-hidden bg-zinc-100 dark:bg-zinc-900 relative">
              {avatarSrc && avatarSrc !== '' ? (
                <img
                  src={avatarSrc}
                  alt={profile?.full_name || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-900">
                  <CircleUser className="w-10 h-10 text-zinc-400" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                <div className="bg-black/60 p-2 rounded-full">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Content - Left Aligned */}
        <main className="w-full pt-12 pb-8">
          <div className="px-4 space-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                maxLength={15}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-900 text-foreground px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors"
                placeholder="Your full name"
              />
            </div>

            {/* Username */}
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

            {/* PERSONAL: Bio */}
            {profile?.account_type !== 'brand' && (
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
                  className="w-full bg-zinc-100 dark:bg-zinc-900 text-foreground px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors resize-none"
                  placeholder="Tell us about yourself"
                />
              </div>
            )}

            {/* BRAND: Description */}
            {profile?.account_type === 'brand' && (
              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex justify-between">
                  <span>Description</span>
                  <span className={`${description.length >= 115 ? 'text-red-500' : 'text-zinc-400'} text-xs`}>{description.length}/115</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={115}
                  rows={3}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 text-foreground px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors resize-none"
                  placeholder="Describe your brand"
                />
              </div>
            )}

            {/* PERSONAL: Date of Birth */}
            {profile?.account_type !== 'brand' && (
              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 text-foreground px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors"
                />
              </div>
            )}

            {/* PERSONAL: Gender */}
            {profile?.account_type !== 'brand' && (
              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 text-foreground px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            )}

            {/* PERSONAL: Relationship Status */}
            {profile?.account_type !== 'brand' && (
              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Relationship Status</label>
                <select
                  value={relationshipStatus}
                  onChange={(e) => setRelationshipStatus(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 text-foreground px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors"
                >
                  <option value="Single">Single</option>
                  <option value="In a relationship">In a relationship</option>
                  <option value="Engaged">Engaged</option>
                  <option value="Married">Married</option>
                  <option value="It's complicated">It's complicated</option>
                  <option value="Separated">Separated</option>
                  <option value="Divorced">Divorced</option>
                </select>
              </div>
            )}

            {/* BRAND: Since */}
            {profile?.account_type === 'brand' && (
              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Since</label>
                <input
                  type="date"
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 text-foreground px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors"
                />
              </div>
            )}

            {/* Your Role */}
            <div>
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Your Role</label>
              <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-black/5 dark:border-white/5">
                <IdentityTagSelector value={identityTag} onChange={setIdentityTag} />
              </div>
            </div>

          </div>
        </main>

        {/* Avatar Selector */}
        <AvatarCoverSelector
          type="avatar"
          isOpen={selectorOpen === 'avatar'}
          hasImage={!!avatarSrc && avatarSrc !== ''}
          onClose={() => setSelectorOpen(null)}
          onAddNew={() => avatarInputRef.current?.click()}
          onDelete={handleDeleteAvatar}
        />

        {/* Cover Selector */}
        <AvatarCoverSelector
          type="cover"
          isOpen={selectorOpen === 'cover'}
          hasImage={!!coverSrc && coverSrc !== ''}
          onClose={() => setSelectorOpen(null)}
          onAddNew={() => coverInputRef.current?.click()}
          onDelete={handleDeleteCover}
        />
      </div>
  );
}

// Edit Profile Skeleton Component
function EditProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      {/* Cover Photo Skeleton - 120px height */}
      <div className="w-full bg-zinc-100 dark:bg-zinc-900" style={{height: '120px'}} />

      {/* Avatar Skeleton - 80px, halfway down */}
      <div className="w-full px-4 relative">
        <div 
          className="w-20 h-20 rounded-full border-4 border-white dark:border-black bg-zinc-200 dark:bg-zinc-800"
          style={{marginTop: '-40px'}}
        />
      </div>

      {/* Form Fields Skeleton */}
      <div className="w-full px-4 pt-12 pb-8 space-y-6">
        {/* Full Name */}
        <div>
          <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
          <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-xl" />
        </div>

        {/* Username */}
        <div>
          <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
          <div className="h-10 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        </div>

        {/* Description */}
        <div>
          <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
          <div className="h-24 w-full bg-zinc-100 dark:bg-zinc-900 rounded-xl" />
        </div>

        {/* Highlight Yourself */}
        <div>
          <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
          <div className="h-16 w-full bg-zinc-100 dark:bg-zinc-900 rounded-xl" />
        </div>

        {/* Date of Birth */}
        <div>
          <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
          <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-xl" />
        </div>

        {/* Gender */}
        <div>
          <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
          <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-xl" />
        </div>

        {/* Relationship Status */}
        <div>
          <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
          <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-900 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
