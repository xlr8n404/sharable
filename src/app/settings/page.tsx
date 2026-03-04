'use client';

import { useState, useEffect } from 'react';
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
  ChevronRight
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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">
      <header className={`fixed top-0 left-0 right-0 z-50 px-4 h-16 flex items-center bg-transparent transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <Link href="/home" className="p-2 -ml-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors" onClick={(e) => { e.preventDefault(); router.back(); }}>
            <ArrowLeft size={24} strokeWidth={1.5} />
          </Link>
        <span className="ml-2 font-bold text-lg">Settings</span>
      </header>

      <main className="max-w-xl mx-auto pt-16 pb-20">
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

          <button 
            onClick={() => setShowLogoutDialog(true)}
            className="w-full flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl border border-black/5 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                <LogOut size={24} strokeWidth={1.5} className="text-zinc-500 dark:text-zinc-400" />
              </div>
              <div className="text-left">
                <p className="font-medium">Log out</p>
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
                <p className="font-medium text-red-500 dark:text-red-400">Delete Account</p>
                <p className="text-sm text-red-400 dark:text-red-400/60">Permanently delete your account</p>
              </div>
            </div>
            <ChevronRight size={24} strokeWidth={1.5} className="text-red-400 dark:text-red-400/60" />
          </button>
        </div>
      </main>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400">
              Are you sure you want to log out of your account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-100 dark:bg-zinc-800 border-black/10 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-zinc-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogout}
              className="bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400">
              This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
              <br /><br />
              Type <span className="font-bold text-red-500 dark:text-red-400">DELETE</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setDeleteConfirmText('')}
              className="bg-zinc-100 dark:bg-zinc-800 border-black/10 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE'}
              className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
