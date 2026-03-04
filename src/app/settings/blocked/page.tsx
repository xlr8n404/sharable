'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, UserX } from 'lucide-react';
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

interface BlockedUser {
  id: string;
  blocked_user_id: string;
  blocked_user: {
    full_name: string;
    username: string;
    avatar_url: string;
  };
}

export default function BlockedUsersPage() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<BlockedUser | null>(null);

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('blocked_users')
        .select(`
          id,
          blocked_user_id,
          blocked_user:profiles!blocked_user_id(full_name, username, avatar_url)
        `)
        .eq('user_id', user.id);
      
      if (data) {
        setBlockedUsers(data as any);
      }
    }
    setLoading(false);
  };

  const handleUnblock = async () => {
    if (!selectedUser) return;
    
    await supabase
      .from('blocked_users')
      .delete()
      .eq('id', selectedUser.id);
    
    setBlockedUsers(prev => prev.filter(u => u.id !== selectedUser.id));
    setShowUnblockDialog(false);
    setSelectedUser(null);
  };

  const getAvatarUrl = (user: BlockedUser) => {
    if (user.blocked_user?.avatar_url) {
      return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.blocked_user.avatar_url}`;
    }
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.blocked_user?.full_name || 'default'}`;
  };

  return (
      <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black">
        <header className="fixed top-0 left-0 right-0 z-50 px-4 h-16 flex items-center bg-transparent">
          <Link href="/settings" className="p-2 -ml-2 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="ml-2 font-bold text-lg">Blocked Users</span>
      </header>

      <main className="max-w-xl mx-auto pt-16 pb-20">
          <div className="p-4">
            {loading ? (
                <Loader />
            ) : blockedUsers.length > 0 ? (

            <div className="space-y-2">
              {blockedUsers.map((user) => (
                <div
                  key={user.id}
                    className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl border border-black/5 dark:border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={getAvatarUrl(user)}
                      alt={user.blocked_user?.full_name}
                      className="w-12 h-12 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800"
                    />
                    <div>
                      <p className="font-medium">{user.blocked_user?.full_name}</p>
                      <p className="text-sm text-zinc-500">@{user.blocked_user?.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      setShowUnblockDialog(true);
                    }}
                      className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white text-sm font-medium rounded-full hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                <UserX className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">No blocked users</h3>
              <p className="text-zinc-500 max-w-[240px]">
                You haven't blocked anyone yet
              </p>
            </div>
          )}
        </div>
      </main>

        <AlertDialog open={showUnblockDialog} onOpenChange={setShowUnblockDialog}>
          <AlertDialogContent className="bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle>Unblock user?</AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400">
              Are you sure you want to unblock {selectedUser?.blocked_user?.full_name}? They will be able to see your posts and interact with you again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-100 dark:bg-zinc-800 border-black/10 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-zinc-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUnblock}
              className="bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Unblock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
