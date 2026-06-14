'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PostCard } from '@/components/PostCard';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Loader } from '@/components/ui/loader';

export default function PostPage() {
  const params = useParams();
  const username = params.username as string;
  const slug = params.slug as string;
  
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ full_name: string; avatar_url: string; username?: string } | null>(null);

  useEffect(() => {
    const loadPost = async () => {
      try {
        setLoading(true);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser({ id: user.id });
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, username')
            .eq('id', user.id)
            .single();
          if (profile) setCurrentUserProfile(profile);
        }

        // Get post by username and slug
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select(`
            id,
            user_id,
            content,
            media_url,
            media_type,
            media_urls,
            media_types,
            slug,
            created_at,
            post_number,
            location_name,
            location_latitude,
            location_longitude,
            likes_count,
            comments_count,
            reposts_count,
            views_count,
            is_community_post,
            community_id,
            user:profiles!posts_user_id_fk(id, full_name, username, avatar_url, identity_tag),
            community:communities(id, name)
          `)
          .eq('slug', slug)
          .single();

        if (postError || !postData) {
          setError('Post not found');
          return;
        }

        // Verify username matches
        if (postData.user?.username !== username) {
          setError('Post not found');
          return;
        }

        setPost(postData);
      } catch (err) {
        console.error('[post-page]', err);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    if (username && slug) {
      loadPost();
    }
  }, [username, slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Post not found</h1>
          <p className="text-zinc-600 dark:text-zinc-400">{error || 'This post may have been deleted'}</p>
        </div>
        <Link href="/home" className="flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-3">
          <Link href="/home" className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Back
          </Link>
        </div>
        
        <div className="border-b border-border">
          <PostCard
            id={post.id}
            user_id={post.user_id}
            post_number={post.post_number}
            slug={post.slug}
            user={post.user}
            content={post.content}
            media_url={post.media_url}
            media_type={post.media_type}
            media_urls={post.media_urls}
            media_types={post.media_types}
            likes_count={post.likes_count}
            comments_count={post.comments_count}
            reposts_count={post.reposts_count}
            views_count={post.views_count}
            created_at={post.created_at}
            is_community_post={post.is_community_post}
            community={post.community}
            currentUserId={currentUser?.id}
            currentUserProfile={currentUserProfile}
            location_name={post.location_name}
            location_latitude={post.location_latitude}
            location_longitude={post.location_longitude}
          />
        </div>
      </div>
    </div>
  );
}
