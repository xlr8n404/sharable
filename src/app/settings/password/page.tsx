'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Eye, EyeOff, Lock, Check } from 'lucide-react';
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

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(true);
  const [showNewPassword, setShowNewPassword] = useState(true);
  const [showConfirmPassword, setShowConfirmPassword] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [success, setSuccess] = useState(false);

  const validatePassword = () => {
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validatePassword()) return;
    setShowConfirmDialog(true);
  };

  const handleChangePassword = async () => {
    setLoading(true);
    setShowConfirmDialog(false);
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  };

  return (
      <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">
        <header className="fixed top-0 left-0 right-0 z-50 px-4 h-16 flex items-center bg-transparent">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="ml-2 font-bold text-lg">Change Password</span>
      </header>

      <main className="max-w-xl mx-auto pt-16 pb-20">
        <div className="p-4">
          {success ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Password Changed!</h3>
              <p className="text-zinc-500 max-w-[280px] mb-6">
                Your password has been updated successfully.
              </p>
                <Link
                  href="/settings"
                  className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black font-bold rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Back to Settings
              </Link>
            </div>
          ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5">
                  <label className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 mb-3">
                    <Lock className="w-5 h-5" />
                    <span className="text-sm font-medium">Current Password</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg text-black dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5">
                  <label className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 mb-3">
                    <Lock className="w-5 h-5" />
                    <span className="text-sm font-medium">New Password</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg text-black dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 pr-12"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2 ml-1">Minimum 6 characters</p>
                </div>

                <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl p-4 border border-black/5 dark:border-white/5">
                  <label className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 mb-3">
                    <Lock className="w-5 h-5" />
                    <span className="text-sm font-medium">Confirm New Password</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg text-black dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                  disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-bold rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader centered={false} className="text-current" />
                      Updating...
                    </span>
                  ) : (
                    'Change Password'
                  )}

              </button>
            </form>
          )}
        </div>
      </main>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent className="bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle>Change Password?</AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400">
              Are you sure you want to change your password? You will need to use your new password to log in next time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-100 dark:bg-zinc-800 border-black/10 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-zinc-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleChangePassword}
              className="bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Change Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
