import { Skeleton } from "@/components/ui/skeleton";

export function PostSkeleton() {
  return (
    <div className="w-full bg-background border-b border-black/[0.05] dark:border-white/[0.05] animate-pulse">
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

        {/* Photo: Facebook-style grid - hero on left, 2 stacked on right */}
        <div className="mb-4 -mx-4 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-2 gap-1" style={{ aspectRatio: '2/1' }}>
            {/* Large hero image on left */}
            <Skeleton className="w-full h-full bg-zinc-200 dark:bg-zinc-800" />
            
            {/* Two stacked images on right */}
            <div className="flex flex-col gap-1">
              <Skeleton className="w-full flex-1 bg-zinc-200 dark:bg-zinc-800" />
              <Skeleton className="w-full flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        </div>

        {/* Interactions: 160px on left, 80px on right */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-[160px] bg-zinc-100 dark:bg-zinc-900" />
          <Skeleton className="h-4 w-[80px] bg-zinc-100 dark:bg-zinc-900" />
        </div>
      </div>
    </div>
  );
}
