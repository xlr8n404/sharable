'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Users, CircleUser, Users2, ShieldCheck, Globe, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Loader } from '@/components/ui/loader';
import { AvatarCoverSelector } from '@/components/avatar-cover-selector';
import { motion, AnimatePresence } from 'framer-motion';
import imageCompression from 'browser-image-compression';

const MEDIA_PROXY_BASE = '/api/media';

const POSTING_OPTIONS = [
  {
    value: 'everyone',
    label: 'Everyone',
    description: 'Any member can post',
    icon: Globe,
  },
  {
    value: 'members_only',
    label: 'Members Only',
    description: 'Only joined members can post',
    icon: Users2,
  },
  {
    value: 'admin_only',
    label: 'Admin Only',
    description: 'Only admins can post',
    icon: ShieldCheck,
  },
];

export default function CommunitySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const communityId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [community, setCommunity] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [postingPermission, setPostingPermission] = useState('everyone');

  // Image state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [newAvatar, setNewAvatar] = useState<File | null>(null);
  const [newCover, setNewCover] = useState<File | null>(null);
  const [deleteAvatar, setDeleteAvatar] = useState(false);
  const [deleteCover, setDeleteCover] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState<'avatar' | 'cover' | null>(null);

  // Transfer Ownership
  const [transferStep, setTransferStep] = useState<0 | 1 | 2>(0); // 0=closed, 1=username, 2=password
  const [transferUsername, setTransferUsername] = useState('');
  const [transferPassword, setTransferPassword] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Get current user
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (!data.user) { router.push('/login'); return; }
      setCurrentUser(data.user);

      // Get community
      const cRes = await fetch(`/api/community/${communityId}`);
      const cData = await cRes.json();
      if (!cData.community) { router.push('/communities'); return; }

      // Only creator/admin can access
      if (cData.community.creator_id !== data.user.id) {
        router.push(`/community/${communityId}`);
        return;
      }

      const c = cData.community;
      setCommunity(c);
      setName(c.name || '');
      setDescription(c.description || '');
      setPostingPermission(c.posting_permission || 'everyone');
      setLoading(false);
    };
    init();
  }, [communityId, router]);

  // Derived image sources
  const coverSrc = coverPreview
    || (community?.cover_url && community.cover_url.trim() !== '' && !deleteCover
      ? community.cover_url
      : null);

  const avatarSrc = avatarPreview
    || (community?.avatar_url && community.avatar_url.trim() !== '' && !deleteAvatar
      ? community.avatar_url
      : null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const t = toast.loading('Compressing…');
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.2, maxWidthOrHeight: 500, useWebWorker: true });
      setNewAvatar(new File([compressed], file.name, { type: file.type }));
      setAvatarPreview(URL.createObjectURL(compressed));
      setDeleteAvatar(false);
      toast.success('Avatar ready', { id: t });
    } catch { toast.error('Failed to process image', { id: t }); }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const t = toast.loading('Compressing…');
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true });
      setNewCover(new File([compressed], file.name, { type: file.type }));
      setCoverPreview(URL.createObjectURL(compressed));
      setDeleteCover(false);
      toast.success('Cover ready', { id: t });
    } catch { toast.error('Failed to process image', { id: t }); }
  };

  const handleDeleteAvatar = () => {
    setNewAvatar(null);
    setAvatarPreview(null);
    setDeleteAvatar(true);
  };

  const handleDeleteCover = () => {
    setNewCover(null);
    setCoverPreview(null);
    setDeleteCover(true);
  };

  const handleTransferNext = async () => {
    const uname = transferUsername.trim().replace(/^@/, '');
    if (!uname) { toast.error('Enter a username'); return; }
    if (uname === community?.username) { toast.error('You already own this community'); return; }
    setTransferLoading(true);
    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(uname)}`);
      const data = await res.json();
      // available: false means username is taken (user exists)
      if (data.available) { toast.error('User not found'); setTransferLoading(false); return; }
      setTransferUsername(uname);
      setTransferStep(2);
    } catch {
      toast.error('Could not verify user');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleTransferConfirm = async () => {
    if (!transferPassword.trim()) { toast.error('Enter your password'); return; }
    setTransferLoading(true);
    try {
      // Verify current owner's password
      const verifyRes = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: transferPassword, userId: currentUser.id }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.valid) {
        toast.error('Incorrect password');
        setTransferLoading(false);
        return;
      }

      // Transfer ownership
      const res = await fetch(`/api/community/${communityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transfer_to: transferUsername.trim(), creator_id: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed');

      toast.success('Ownership transferred!');
      router.push('/communities');
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Community name is required'); return; }
    setSaving(true);
    try {
      let avatarUrl = community.avatar_url;
      let coverUrl = community.cover_url;

      if (deleteAvatar) {
        avatarUrl = '';
      } else if (newAvatar) {
        const fd = new FormData();
        fd.append('file', newAvatar);
        fd.append('bucket', 'avatars');
        const r = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!r.ok) throw new Error('Avatar upload failed');
        const { path } = await r.json();
        avatarUrl = path;
      }

      if (deleteCover) {
        coverUrl = '';
      } else if (newCover) {
        const fd = new FormData();
        fd.append('file', newCover);
        fd.append('bucket', 'covers');
        const r = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!r.ok) throw new Error('Cover upload failed');
        const { path } = await r.json();
        coverUrl = path;
      }

      const res = await fetch(`/api/community/${communityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category: community.category,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
          posting_permission: postingPermission,
          creator_id: currentUser.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      toast.success('Community updated!');
      router.push(`/community/${communityId}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background animate-pulse">
        <div className="w-full bg-zinc-100 dark:bg-zinc-900" style={{ height: '120px' }} />
        <div className="w-full px-4 pt-12 pb-8 space-y-6">
          {[...Array(5)].map((_, i) => (
            <div key={i}>
              <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
              <div className="h-11 w-full bg-zinc-100 dark:bg-zinc-900 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Cover Photo + overlaid header ─────────────────────────────── */}
      <div className="relative">
        <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />

        {/* Cover */}
        <div
          onClick={() => setSelectorOpen('cover')}
          className="w-full overflow-hidden cursor-pointer group relative bg-zinc-100 dark:bg-zinc-900"
          style={{ height: '120px' }}
        >
          {coverSrc ? (
            <img src={coverSrc} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-200 dark:from-zinc-800 to-zinc-300 dark:to-zinc-900" />
          )}
          {/* Camera overlay */}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-black/60 p-3 rounded-full">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Top header overlay on cover */}
        <div className="absolute top-0 left-0 right-0 px-4 h-16 flex items-center justify-between z-10">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 font-bold text-sm rounded-full bg-black/60 dark:bg-white/60 text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving ? <Loader centered={false} className="text-current" /> : 'Save'}
          </button>
        </div>

        {/* Avatar — halfway down cover (80px, top:120px, translateY -50%) */}
        <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        <div
          onClick={() => setSelectorOpen('avatar')}
          className="absolute left-4 cursor-pointer z-10"
          style={{ top: '120px', transform: 'translateY(-50%)' }}
        >
          <div className="w-20 h-20 rounded-full border-4 border-white dark:border-black overflow-hidden bg-zinc-100 dark:bg-zinc-900 relative">
            {avatarSrc ? (
              <img src={avatarSrc} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Users className="w-10 h-10 text-zinc-400 dark:text-zinc-600" strokeWidth={1} />
              </div>
            )}
            {/* Camera overlay */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
              <div className="bg-black/60 p-2 rounded-full">
                <Camera className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form ──────────────────────────────────────────────────────── */}
      <main className="w-full pt-14 pb-16">
        <div className="px-4 space-y-6">

          {/* Community Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              Community Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={60}
              className="w-full bg-zinc-100 dark:bg-zinc-900 text-foreground px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors"
              placeholder="Community name"
            />
          </div>

          {/* Username — read only */}
          <div>
            <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              Sharable ID
            </label>
            <input
              type="text"
              value={community?.username || ''}
              disabled
              className="w-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 px-4 py-3 rounded-xl border border-black/5 dark:border-white/5 outline-none cursor-not-allowed"
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1.5">Sharable ID cannot be changed</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex justify-between">
              <span>Description</span>
              <span className={`text-xs ${description.length >= 480 ? 'text-red-500' : 'text-zinc-400'}`}>
                {description.length}/500
              </span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
              rows={4}
              className="w-full bg-zinc-100 dark:bg-zinc-900 text-foreground px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors resize-none"
              placeholder="Describe your community…"
            />
          </div>

          {/* ── Extra Settings ─────────────────────────────────────────── */}
          <div className="pt-2">
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-4">
              Extra Settings
            </div>

            {/* Who can post */}
            <div>
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
                Who can post in this community?
              </label>
              <div className="space-y-2">
                {POSTING_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const active = postingPermission === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPostingPermission(opt.value)}
                      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-colors text-left ${
                        active
                          ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black'
                          : 'bg-zinc-100 dark:bg-zinc-900 border-black/10 dark:border-white/10 text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        active ? 'bg-white/20' : 'bg-black/5 dark:bg-white/5'
                      }`}>
                        <Icon size={18} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{opt.label}</p>
                        <p className={`text-xs mt-0.5 ${active ? 'opacity-70' : 'text-zinc-500 dark:text-zinc-400'}`}>
                          {opt.description}
                        </p>
                      </div>
                      {/* Radio dot */}
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        active
                          ? 'border-white dark:border-black bg-background'
                          : 'border-black/20 dark:border-white/20'
                      }`}>
                        {active && (
                          <div className="w-2.5 h-2.5 rounded-full bg-black dark:bg-white" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          {/* Transfer Ownership */}
          <div className="pt-4 border-t border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => { setTransferUsername(''); setTransferPassword(''); setTransferStep(1); }}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-red-500/30 bg-red-50 dark:bg-red-950/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">Transfer Ownership</p>
                <p className="text-xs mt-0.5 opacity-70">Transfer this community to another member</p>
              </div>
            </button>
          </div>

        </div>
        </div>
      </main>

      {/* Transfer Ownership Sheet */}
      <AnimatePresence>
        {transferStep > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => { setTransferStep(0); setTransferPassword(''); }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
              className="fixed bottom-0 left-0 right-0 z-50 max-w-xl mx-auto rounded-t-2xl bg-white dark:bg-zinc-950 overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center" style={{ paddingTop: '16px', paddingBottom: '16px' }}>
                <div className="bg-zinc-300 dark:bg-zinc-700 rounded-full" style={{ width: '48px', height: '8px' }} />
              </div>
              <div className="px-4 pb-8">
                {transferStep === 1 && (
                  <>
                    <h2 className="text-xl font-bold text-foreground mb-1">Transfer Ownership</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Enter the username of the member you want to transfer this community to.</p>
                    <div className="mb-5">
                      <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">New Owner's Username</label>
                      <input
                        type="text"
                        value={transferUsername}
                        onChange={e => setTransferUsername(e.target.value)}
                        autoFocus
                        placeholder="@username"
                        className="w-full bg-zinc-100 dark:bg-zinc-900 text-foreground px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors"
                        onKeyDown={e => { if (e.key === 'Enter') handleTransferNext(); }}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setTransferStep(0)}
                        className="flex-1 py-3 font-bold text-sm rounded-2xl border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900 text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleTransferNext}
                        disabled={transferLoading || !transferUsername.trim()}
                        className="flex-1 py-3 font-bold text-sm rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {transferLoading ? <Loader centered={false} className="text-current" /> : 'Next'}
                      </button>
                    </div>
                  </>
                )}

                {transferStep === 2 && (
                  <>
                    <h2 className="text-xl font-bold text-foreground mb-1">Confirm Transfer</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                      You're about to transfer ownership to <span className="font-bold text-foreground">@{transferUsername}</span>. Enter your password to confirm.
                    </p>
                    <div className="mb-5">
                      <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Your Password</label>
                      <input
                        type="password"
                        value={transferPassword}
                        onChange={e => setTransferPassword(e.target.value)}
                        autoFocus
                        placeholder="Enter your password"
                        className="w-full bg-zinc-100 dark:bg-zinc-900 text-foreground px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors"
                        onKeyDown={e => { if (e.key === 'Enter') handleTransferConfirm(); }}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setTransferStep(1); setTransferPassword(''); }}
                        className="flex-1 py-3 font-bold text-sm rounded-2xl border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900 text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleTransferConfirm}
                        disabled={transferLoading || !transferPassword.trim()}
                        className="flex-1 py-3 font-bold text-sm rounded-2xl bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {transferLoading ? <Loader centered={false} className="text-current" /> : 'Transfer'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Avatar Selector Sheet */}
      <AvatarCoverSelector
        type="avatar"
        isOpen={selectorOpen === 'avatar'}
        hasImage={!!avatarSrc}
        onClose={() => setSelectorOpen(null)}
        onAddNew={() => avatarInputRef.current?.click()}
        onDelete={handleDeleteAvatar}
      />

      {/* Cover Selector Sheet */}
      <AvatarCoverSelector
        type="cover"
        isOpen={selectorOpen === 'cover'}
        hasImage={!!coverSrc}
        onClose={() => setSelectorOpen(null)}
        onAddNew={() => coverInputRef.current?.click()}
        onDelete={handleDeleteCover}
      />
    </div>
  );
}
