'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SquarePlus } from 'lucide-react';
import CommunityCard from '@/components/CommunityCard';
import { CommunitySkeleton } from '@/components/CommunitySkeleton';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';

export default function CommunitiesPage() {
  const router = useRouter();
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCommunities, setUserCommunities] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      setCurrentUser(data.user);
    };
    getUser();
  }, []);

  useEffect(() => {
    fetchCommunities();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUserCommunities();
    }
  }, [currentUser]);

  const fetchCommunities = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/communities`);
      const data = await res.json();
      setCommunities(data.communities || []);
    } catch (error) {
      console.error('Error fetching communities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCommunities = async () => {
    try {
      const { data, error } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', currentUser.id);

      if (!error && data) {
        setUserCommunities(new Set(data.map((m: any) => m.community_id)));
      }
    } catch (error) {
      console.error('Error fetching user communities:', error);
    }
  };

  const handleJoin = async (communityId: string) => {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id }),
      });

      if (res.ok) {
        setUserCommunities(prev => new Set([...Array.from(prev), communityId]));
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to join community');
      }
    } catch (error) {
      console.error('Error joining community:', error);
      alert('Error joining community');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Fixed Header - 64dp */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 bg-background">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-syne)]">Communities</h1>
        <button
          onClick={() => router.push('/communities/create')}
          className="p-2 text-foreground hover:bg-accent rounded-full transition-colors"
        >
          <SquarePlus size={28} strokeWidth={1.5} />
        </button>
      </header>

      {/* Main Content */}
      <main className="w-full pt-20 px-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <CommunitySkeleton key={i} />
            ))}
          </div>
        ) : communities.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No communities found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {communities.map((community: any) => (
              <CommunityCard
                key={community.id}
                community={community}
                onJoin={handleJoin}
                isMember={userCommunities.has(community.id)}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
