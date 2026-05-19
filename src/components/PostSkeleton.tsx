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

        {/* Photo Grid: Facebook style - Large left, 2 small right */}
        <div className="mb-4">
          <div className="flex gap-1 -mx-4 px-4">
            {/* Left large skeleton - 120px x 120px (1:1) */}
            <div className="flex-1">
              <Skeleton className="w-full aspect-square h-[120px] bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
            </div>
            
            {/* Right side: 2 stacked skeletons - 60px x 60px each (1:1) */}
            <div className="w-1/3 flex flex-col gap-1">
              <Skeleton className="w-full aspect-square bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
              <Skeleton className="w-full aspect-square bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Interactions: 50% width on left, Save icon on right */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-1/2 bg-zinc-100 dark:bg-zinc-900" />
          <Skeleton className="w-5 h-5 bg-zinc-100 dark:bg-zinc-900" />
        </div>
      </div>
    </div>
  );
}
