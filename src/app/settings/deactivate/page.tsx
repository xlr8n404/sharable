'use client';
import { useNavBack } from '@/components/NavigationHistoryProvider';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
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

export default function DeactivateAccountPage() {
  const router = useRouter();
  const { goBack } = useNavBack();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!password) {
      setError('Please enter your password');
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleDeactivateAccount = async () => {
    if (confirmText !== 'DEACTIVATE') {
      setError('Please type DEACTIVATE to confirm');
      return;
    }

    setLoading(true);
    setShowConfirmDialog(false);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      // Verify password by attempting to sign in
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('password_hash')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        setError('Error verifying credentials');
        setLoading(false);
        return;
      }

      // Import and use comparePassword
      const response = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, userId: user.id }),
      });

      if (!response.ok) {
        setError('Invalid password');
        setLoading(false);
        return;
      }

      // Deactivate the account
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_deactivated: true })
        .eq('id', user.id);

      if (updateError) {
        setError('Failed to deactivate account');
        setLoading(false);
        return;
      }

      // Sign out the user
      await supabase.auth.signOut();
      
      // Redirect to home
      router.push('/');
    } catch (err) {
      setError('An error occurred. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">
      <header className="fixed top-0 left-0 right-0 z-50 px-4 h-16 flex items-center bg-transparent border-b-0">
        <button onClick={() => goBack()} className="p-2 -ml-2 text-foreground hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="ml-2 font-bold text-lg">Deactivate Account</span>
      </header>

      <main className="max-w-xl mx-auto pt-16 pb-20">
        <div className="p-4">
          {/* Warning Banner */}
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 dark:text-red-200 mb-2">Account Deactivation</p>
                <ul className="text-sm text-red-800 dark:text-red-300 space-y-1 list-disc list-inside">
                  <li>Your account will not be visible to other users</li>
                  <li>Your posts will not appear in feeds</li>
                  <li>You can reactivate by logging in again</li>
                  <li>Your data will not be deleted</li>
                </ul>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5">
              <label className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 mb-3">
                <Lock className="w-5 h-5" />
                <span className="text-sm font-medium">Confirm with Password</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-950/30 border border-red-500/20 rounded-2xl">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-4 bg-red-600 dark:bg-red-600 text-white font-bold rounded-full hover:bg-red-700 dark:hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader centered={false} className="text-current" />
                  Deactivating...
                </span>
              ) : (
                'Deactivate Account'
              )}
            </button>

            <Link
              href="/settings"
              className="block w-full py-4 bg-zinc-100 dark:bg-zinc-900 text-foreground font-bold rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-center"
            >
              Cancel
            </Link>
          </form>
        </div>
      </main>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400">Deactivate Account?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400">
              <p className="mb-4">Your account will be deactivated. You won't be visible to other users, and your posts won't appear in feeds.</p>
              <p className="mb-4 font-medium">You can reactivate your account anytime by logging in again.</p>
              <p className="mb-3">Type <span className="font-mono font-bold text-foreground">DEACTIVATE</span> to confirm:</p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DEACTIVATE"
                className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-100 dark:bg-zinc-800 border-black/10 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-zinc-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeactivateAccount}
              disabled={confirmText !== 'DEACTIVATE' || loading}
              className="bg-red-600 dark:bg-red-600 text-white hover:bg-red-700 dark:hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
