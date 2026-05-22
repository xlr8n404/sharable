import { Skeleton } from "@/components/ui/skeleton";
import { PostSkeleton } from "./PostSkeleton";

export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background animate-pulse pb-20">
      <div className="w-full">
        {/* Cover Photo - 100% width, 120px height */}
        <Skeleton className="w-full bg-zinc-100 dark:bg-zinc-900" style={{height: '120px'}} />

        <div className="px-4 relative z-10">
          {/* Profile Picture - 80px, halfway down cover */}
          <div className="-mt-10 mb-6">
            <Skeleton className="w-20 h-20 rounded-full border-4 border-white dark:border-black bg-zinc-200 dark:bg-zinc-800" />
          </div>

          {/* Full Name Skeleton */}
          <div className="mb-4">
            <Skeleton className="h-6 w-48 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          {/* Stats: Posts, Followers, Following */}
          <div className="flex gap-6 mb-6">
            <Skeleton className="h-4 w-20 bg-zinc-100 dark:bg-zinc-900" />
            <Skeleton className="h-4 w-24 bg-zinc-100 dark:bg-zinc-900" />
            <Skeleton className="h-4 w-24 bg-zinc-100 dark:bg-zinc-900" />
          </div>

          {/* Bio: 3 lines (90%, 100%, 75%) */}
          <div className="space-y-2 mb-6">
            <Skeleton className="h-4 w-[90%] bg-zinc-100 dark:bg-zinc-900" />
            <Skeleton className="h-4 w-full bg-zinc-100 dark:bg-zinc-900" />
            <Skeleton className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-900" />
          </div>

          {/* Edit and Create Post Buttons - 50/50 split */}
          <div className="flex gap-3 mb-6">
            <Skeleton className="flex-1 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <Skeleton className="flex-1 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>

          {/* Tabs: Posts, Saved, About */}
          <div className="flex border-b border-black/[0.05] dark:border-white/[0.05] mb-4">
            <div className="flex-1 flex flex-col items-center py-3">
              <Skeleton className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="flex-1 flex flex-col items-center py-3">
              <Skeleton className="h-4 w-12 bg-zinc-100 dark:bg-zinc-900" />
            </div>
            <div className="flex-1 flex flex-col items-center py-3">
              <Skeleton className="h-4 w-12 bg-zinc-100 dark:bg-zinc-900" />
            </div>
          </div>

          {/* Post Skeletons */}
          <div className="-mx-4">
            {[...Array(3)].map((_, i) => (
              <PostSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
