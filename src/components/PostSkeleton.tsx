import { Skeleton } from "@/components/ui/skeleton";

export function PostSkeleton({ mediaCount }: { mediaCount?: 1 | 2 | 3 }) {
  const count: 1 | 2 | 3 = mediaCount ?? 3;

  return (
    <div className="w-full bg-background border-b border-black/[0.05] dark:border-white/[0.05] animate-pulse">
      <div className="px-4 pt-4 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Skeleton className="w-10 h-10 rounded-full shrink-0 bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28 bg-zinc-200 dark:bg-zinc-800" />
              <Skeleton className="h-3 w-20 bg-zinc-100 dark:bg-zinc-900" />
            </div>
          </div>
          <Skeleton className="w-6 h-6 rounded-full shrink-0 bg-zinc-100 dark:bg-zinc-900 ml-2" />
        </div>

        {/* Content lines */}
        <div className="space-y-2 mb-3">
          <Skeleton className="h-4 w-[90%] bg-zinc-100 dark:bg-zinc-900" />
          <Skeleton className="h-4 w-full bg-zinc-100 dark:bg-zinc-900" />
          <Skeleton className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-900" />
        </div>

        {/* Media skeleton — matches real PostCard layout */}
        <div className="mb-3 rounded-2xl overflow-hidden border border-black/5 dark:border-white/10">
          {count === 1 && (
            // Single: 16:9 aspect ratio (common for photos/videos)
            <Skeleton className="w-full bg-zinc-200 dark:bg-zinc-800" style={{ aspectRatio: '16/9' }} />
          )}
          {count === 2 && (
            // Two side-by-side 1:1
            <div className="grid grid-cols-2 gap-[2px]">
              <Skeleton className="w-full bg-zinc-200 dark:bg-zinc-800 aspect-square" />
              <Skeleton className="w-full bg-zinc-200 dark:bg-zinc-800 aspect-square" />
            </div>
          )}
          {count === 3 && (
            // Left large, right two stacked — square container
            <div className="grid grid-cols-2 gap-[2px]" style={{ aspectRatio: '1/1' }}>
              <Skeleton className="bg-zinc-200 dark:bg-zinc-800" style={{ height: '100%' }} />
              <div className="flex flex-col gap-[2px]" style={{ height: '100%' }}>
                <Skeleton className="bg-zinc-200 dark:bg-zinc-800" style={{ flex: 1 }} />
                <Skeleton className="bg-zinc-200 dark:bg-zinc-800" style={{ flex: 1 }} />
              </div>
            </div>
          )}
        </div>

        {/* Interaction buttons */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-[160px] bg-zinc-100 dark:bg-zinc-900" />
          <Skeleton className="h-4 w-[80px] bg-zinc-100 dark:bg-zinc-900" />
        </div>
      </div>
    </div>
  );
}
