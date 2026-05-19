import { Skeleton } from "@/components/ui/skeleton";

export function PostSkeleton() {
  return (
    <div className="w-full bg-white dark:bg-black border-b border-black/[0.05] dark:border-white/[0.05] animate-pulse">
      <div className="px-4 pt-4 pb-4">
        {/* Header: Avatar (40px), Full Name, Three-dot Menu */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Avatar Skeleton - 40px */}
            <Skeleton className="w-10 h-10 rounded-full shrink-0 bg-zinc-200 dark:bg-zinc-800" />
            
            {/* Full Name */}
            <Skeleton className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800" />
          </div>
          
          {/* Three-dot Menu Skeleton */}
          <Skeleton className="w-6 h-6 rounded-full shrink-0 bg-zinc-100 dark:bg-zinc-900 ml-2" />
        </div>

        {/* Content: 3 lines (90%, 100%, 75%) */}
        <div className="space-y-2 mb-4">
          <Skeleton className="h-4 w-[90%] bg-zinc-100 dark:bg-zinc-900" />
          <Skeleton className="h-4 w-full bg-zinc-100 dark:bg-zinc-900" />
          <Skeleton className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-900" />
        </div>

        {/* Photo: 100% width, 120px height */}
        <div className="mb-4 -mx-4">
          <Skeleton className="w-full h-[120px] bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        </div>

        {/* Interactions: 120px on left, 80px on right */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-[120px] bg-zinc-100 dark:bg-zinc-900" />
          <Skeleton className="h-4 w-[80px] bg-zinc-100 dark:bg-zinc-900" />
        </div>
      </div>
    </div>
  );
}
