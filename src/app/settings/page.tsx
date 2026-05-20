'use client';
import { useNavBack } from '@/components/NavigationHistoryProvider';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import {
  ArrowLeft,
  Bell,
  Moon,
  Sun,
  UserX,
  Lock,
  LogOut,
  Trash2,
  ChevronRight,
  Sparkles,
  UserCircle,
  ShieldCheck,
  Users,
  X
} from 'lucide-react';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';

export default function SettingsPage() {
  const isHeaderVisible = useScrollDirection();
  const router = useRouter();
  const { goBack } = useNavBack();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [dismissedRecs, setDismissedRecs] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    // Load profile to determine recommendations
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('full_name, avatar_url, bio, username').eq('id', user.id).maybeSingle()
        .then(({ data }) => { if (data) setProfile(data); });
    });
    // Load dismissed recs from localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('dismissed_recs') || '[]');
      setDismissedRecs(new Set(saved));
    } catch {}
  }, []);

  const dismissRec = (id: string) => {
    setDismissedRecs(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem('dismissed_recs', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Clean up storage
      const buckets = ['posts', 'avatars', 'covers'];
      for (const bucket of buckets) {
        try {
          const { data: files } = await supabase.storage.from(bucket).list(user.id);
          if (files && files.length > 0) {
            await supabase.storage.from(bucket).remove(files.map(f => `${user.id}/${f.name}`));
          }
        } catch (err) {
          console.error(`Error cleaning up ${bucket} storage:`, err);
        }
      }

      await supabase.from('posts').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('id', user.id);
      await supabase.auth.signOut();
      router.push('/');
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="h-16 flex items-center px-4 bg-white dark:bg-black border-b border-black/5 dark:border-white/5 relative">
          <div className="absolute left-4">
            <ArrowLeft size={24} strokeWidth={1.5} className="text-zinc-400" />
          </div>
          <div className="flex-1 text-center">
            <span className="font-bold text-2xl">Settings & more</span>
          </div>
        </header>
        <main className="max-w-xl mx-auto p-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">
      <header className={`fixed top-0 left-0 right-0 z-50 px-4 h-16 flex items-center bg-white dark:bg-black transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="absolute left-4">
          <Link href="/home" className="p-2 -ml-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors flex items-center justify-center" onClick={(e) => { e.preventDefault(); goBack(); }}>
            <ArrowLeft size={24} strokeWidth={1.5} />
          </Link>
        </div>
        <div className="flex-1 text-center">
          <span className="font-bold text-2xl">Settings & more</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto pt-16 pb-20">
        {/* Recommended Section */}
        {mounted && (() => {
          const recs = [
            ...(!profile?.bio && !dismissedRecs.has('bio') ? [{
              id: 'bio',
              icon: UserCircle,
              title: 'Complete your profile',
              description: 'Add a bio so others can know you better.',
              action: () => router.push('/profile/edit'),
              actionLabel: 'Add bio',
              color: 'blue',
            }] : []),
            ...(!profile?.avatar_url && !dismissedRecs.has('avatar') ? [{
              id: 'avatar',
              icon: UserCircle,
              title: 'Add a profile photo',
              description: 'A photo helps people recognize you.',
              action: () => router.push('/profile/edit'),
              actionLabel: 'Upload photo',
              color: 'purple',
            }] : []),
            ...(!alertsEnabled && !dismissedRecs.has('alerts') ? [{
              id: 'alerts',
              icon: Bell,
              title: 'Enable alerts',
              description: 'Stay updated with likes, comments and mentions.',
              action: () => setAlertsEnabled(true),
              actionLabel: 'Enable',
              color: 'orange',
            }] : []),
            ...(!dismissedRecs.has('community') ? [{
              id: 'community',
              icon: Users,
              title: 'Join a community',
              description: 'Connect with people who share your interests.',
              action: () => router.push('/communities'),
              actionLabel: 'Browse',
              color: 'green',
            }] : []),
            ...(!dismissedRecs.has('security') ? [{
              id: 'security',
              icon: ShieldCheck,
              title: 'Secure your account',
              description: 'Set a strong password to protect your account.',
              action: () => router.push('/settings/password'),
              actionLabel: 'Update',
              color: 'zinc',
            }] : []),
          ];

          if (recs.length === 0) return null;

          const colorMap: Record<string, string> = {
            blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-500/20',
            purple: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-500/20',
            orange: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-500/20',
            green: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/20',
            zinc: 'bg-zinc-100 dark:bg-zinc-900/50 border-black/5 dark:border-white/5',
          };
          const iconColorMap: Record<string, string> = {
            blue: 'text-blue-500',
            purple: 'text-purple-500',
            orange: 'text-orange-500',
            green: 'text-emerald-500',
            zinc: 'text-zinc-500 dark:text-zinc-400',
          };
          const btnColorMap: Record<string, string> = {
            blue: 'bg-blue-500 hover:bg-blue-600 text-white',
            purple: 'bg-purple-500 hover:bg-purple-600 text-white',
            orange: 'bg-orange-500 hover:bg-orange-600 text-white',
            green: 'bg-emerald-500 hover:bg-emerald-600 text-white',
            zinc: 'bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200',
          };

          return (
            <div className="p-4 pb-0 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} strokeWidth={2} className="text-zinc-400" />
                <span className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Recommended</span>
              </div>
              {recs.map(rec => {
                const Icon = rec.icon;
                return (
                  <div key={rec.id} className={`flex items-center gap-3 p-4 rounded-2xl border ${colorMap[rec.color]}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-white/60 dark:bg-black/30`}>
                      <Icon size={20} strokeWidth={1.5} className={iconColorMap[rec.color]} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{rec.title}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{rec.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={rec.action}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${btnColorMap[rec.color]}`}
                      >
                        {rec.actionLabel}
                      </button>
                      <button
                        onClick={() => dismissRec(rec.id)}
                        className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                      >
                        <X size={14} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        <div className="p-4 space-y-2">
            <div className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl border border-black/5 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                  <Bell size={24} strokeWidth={1.5} className="text-zinc-500 dark:text-zinc-400" />
                </div>
                <div>
                  <p className="font-medium">Alerts</p>
                  <p className="text-sm text-zinc-500">Push alerts</p>
                </div>
              </div>
              <Switch 
                checked={alertsEnabled} 
                onCheckedChange={setAlertsEnabled}
                className="data-[state=checked]:bg-black dark:data-[state=checked]:bg-white"
              />
            </div>

          <div className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                {mounted && theme === 'dark' ? (
                  <Moon size={24} strokeWidth={1.5} className="text-zinc-500 dark:text-zinc-400" />
                ) : (
                  <Sun size={24} strokeWidth={1.5} className="text-zinc-500 dark:text-zinc-400" />
                )}
              </div>
              <div>
                <p className="font-medium">Dark Mode</p>
                <p className="text-sm text-zinc-500">Use dark theme</p>
              </div>
            </div>
            <Switch 
              checked={mounted ? theme === 'dark' : true}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              className="data-[state=checked]:bg-black dark:data-[state=checked]:bg-white"
            />
          </div>

          <Link 
            href="/settings/blocked"
            className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl border border-black/5 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                <UserX size={24} strokeWidth={1.5} className="text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <p className="font-medium">Blocked Users</p>
                <p className="text-sm text-zinc-500">Manage blocked accounts</p>
              </div>
            </div>
            <ChevronRight size={24} strokeWidth={1.5} className="text-zinc-500" />
          </Link>

          <Link 
            href="/settings/password"
            className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl border border-black/5 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                <Lock size={24} strokeWidth={1.5} className="text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <p className="font-medium">Change Password</p>
                <p className="text-sm text-zinc-500">Update your password</p>
              </div>
            </div>
            <ChevronRight size={24} strokeWidth={1.5} className="text-zinc-500" />
          </Link>

          <Link 
            href="/settings/deactivate"
            className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-950/30 rounded-2xl border border-orange-200 dark:border-orange-500/20 hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center">
                <UserX size={24} strokeWidth={1.5} className="text-orange-500 dark:text-orange-400" />
              </div>
              <div className="text-left">
                <p className="font-medium text-orange-600 dark:text-orange-400">Deactivate Account</p>
                <p className="text-sm text-orange-500 dark:text-orange-400/60">Temporarily disable your account</p>
              </div>
            </div>
            <ChevronRight size={24} strokeWidth={1.5} className="text-orange-400 dark:text-orange-400/60" />
          </Link>

          <button 
            onClick={() => setShowLogoutDialog(true)}
            className="w-full flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl border border-black/5 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                <LogOut size={24} strokeWidth={1.5} className="text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <p className="font-medium">Logout</p>
                <p className="text-sm text-zinc-500">Sign out of your account</p>
              </div>
            </div>
            <ChevronRight size={24} strokeWidth={1.5} className="text-zinc-500" />
          </button>

          <button 
            onClick={() => setShowDeleteDialog(true)}
            className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center">
                <Trash2 size={24} strokeWidth={1.5} className="text-red-500 dark:text-red-400" />
              </div>
              <div className="text-left">
                <p className="font-medium text-red-600 dark:text-red-400">Delete Account</p>
                <p className="text-sm text-red-500 dark:text-red-400/60">Permanently remove your data</p>
              </div>
            </div>
            <ChevronRight size={24} strokeWidth={1.5} className="text-red-400 dark:text-red-400/60" />
          </button>
        </div>
      </main>

      <BottomNav />

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="bg-white dark:bg-zinc-900 border-black/5 dark:border-white/5 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogout}
              className="bg-black dark:bg-white text-white dark:text-black rounded-xl"
            >
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white dark:bg-zinc-900 border-black/5 dark:border-white/5 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent. All your posts, profile data and media will be deleted.
              Type <span className="font-bold text-black dark:text-white">DELETE</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <input 
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-none focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE'}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
